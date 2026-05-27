/**
 * editChat.test.ts
 *
 * Unit tests for the editChat controller.
 * All Mongoose model calls are mocked — no real MongoDB connection is made.
 *
 * Tested scenarios:
 *   rollbackTimeline:
 *     1. Success path — valid messageId (index 1) restores previousAssetId
 *     2. 404 — messageId not found in chat messages
 *     3. 403 / 404 — project not found (ownership gate)
 *     4. 422 — target message has no previousAssetId
 *     5. 401 — no userId (unauthenticated)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// ─── Mocks (hoisted before imports that use them) ─────────────────────────────

vi.mock("../../model/project.model", () => ({
    default: { findById: vi.fn() },
}));

vi.mock("../../model/editChat.model", () => ({
    default: { findById: vi.fn() },
}));

vi.mock("../../model/timelineitem.model", () => ({
    default: { findByIdAndUpdate: vi.fn() },
}));

// Queue and publisher are not exercised in rollback — stub them out
vi.mock("../../queue/editQueue", () => ({
    enqueueEdit: vi.fn().mockResolvedValue("job-123"),
}));

vi.mock("../../queue/eventPublisher.util", () => ({
    publishProgress: vi.fn(),
}));

import Project from "../../model/project.model";
import EditChat from "../../model/editChat.model";
import TimelineItem from "../../model/timelineitem.model";
import { rollbackTimeline } from "../editChat.controller";
import { Types } from "mongoose";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockProjectFind = Project.findById as unknown as ReturnType<typeof vi.fn>;
const mockChatFind    = EditChat.findById as unknown as ReturnType<typeof vi.fn>;
const mockTLIUpdate   = TimelineItem.findByIdAndUpdate as unknown as ReturnType<typeof vi.fn>;

const VALID_PROJECT_ID    = new Types.ObjectId().toHexString();
const VALID_EDIT_CHAT_ID  = new Types.ObjectId().toHexString();
const VALID_TLI_ID        = new Types.ObjectId().toHexString();
const VALID_PREV_ASSET_ID = new Types.ObjectId().toHexString();
const VALID_NEW_ASSET_ID  = new Types.ObjectId().toHexString();

/** Build a minimal mock express Request */
function makeReq(
    body: Record<string, unknown>,
    userId: string | null = "user-abc"
): Partial<Request> & { userId?: string } {
    const req: Partial<Request> & { userId?: string } = { body };
    if (userId !== null) req.userId = userId;
    return req;
}

/** Build a mock express Response that captures status + json */
function makeRes() {
    const res = {
        _status: 0,
        _json: null as unknown,
        status(code: number) {
            this._status = code;
            return this;
        },
        json(body: unknown) {
            this._json = body;
            return this;
        },
    };
    return res;
}

/** A fake EditChat document with two messages:
 *   index 0: user message
 *   index 1: assistant message recording the edit (has previousAssetId)
 */
function makeFakeEditChat(options: { hasPreviousAsset?: boolean } = {}) {
    const messages: unknown[] = [
        {
            role: "user",
            content: { editPrompt: "make it red", assetId: VALID_NEW_ASSET_ID },
            timestamp: new Date(),
            timelineObject: {},
        },
        {
            role: "assistant",
            content: {
                messageId: undefined, // we'll match by index
                newAssetId: VALID_NEW_ASSET_ID,
                previousAssetId: options.hasPreviousAsset !== false ? VALID_PREV_ASSET_ID : undefined,
            },
            timestamp: new Date(),
            timelineObject: {},
        },
    ];

    const save = vi.fn().mockResolvedValue(undefined);

    return { messages, save, _id: new Types.ObjectId(VALID_EDIT_CHAT_ID) };
}

beforeEach(() => {
    vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("rollbackTimeline", () => {
    it("success path: restores previousAssetId and appends system message", async () => {
        const fakeChat = makeFakeEditChat();

        mockProjectFind.mockResolvedValue({
            _id: VALID_PROJECT_ID,
            edit_chat: VALID_EDIT_CHAT_ID,
        });
        mockChatFind.mockResolvedValue(fakeChat);
        mockTLIUpdate.mockResolvedValue({
            _id: VALID_TLI_ID,
            assetId: new Types.ObjectId(VALID_PREV_ASSET_ID),
        });

        const req = makeReq({
            projectId: VALID_PROJECT_ID,
            messageId: "1", // index of the assistant message
            timelineItemId: VALID_TLI_ID,
        });
        const res = makeRes();

        await rollbackTimeline(req as Request, res as unknown as Response);

        expect(res._status).toBe(200);
        const body = res._json as { success: boolean; data: Record<string, string> };
        expect(body.success).toBe(true);
        expect(body.data.restoredAssetId).toBe(VALID_PREV_ASSET_ID);
        expect(body.data.note).toContain("Rolled back edit #2");

        // TimelineItem must have been updated to the previousAssetId
        expect(mockTLIUpdate).toHaveBeenCalledWith(
            VALID_TLI_ID,
            expect.objectContaining({ assetId: expect.any(Types.ObjectId) }),
            { new: true }
        );

        // A system message must have been appended to the chat
        expect(fakeChat.save).toHaveBeenCalled();
        const lastMsg = fakeChat.messages[fakeChat.messages.length - 1] as {
            role: string;
            content: { action: string };
        };
        expect(lastMsg.role).toBe("assistant");
        expect(lastMsg.content.action).toBe("rollback");
    });

    it("404: project not found returns 404", async () => {
        mockProjectFind.mockResolvedValue(null);

        const req = makeReq({
            projectId: VALID_PROJECT_ID,
            messageId: "1",
            timelineItemId: VALID_TLI_ID,
        });
        const res = makeRes();

        await rollbackTimeline(req as Request, res as unknown as Response);

        expect(res._status).toBe(404);
        const body = res._json as { success: boolean; error: string };
        expect(body.success).toBe(false);
        expect(body.error).toMatch(/project not found/i);
    });

    it("404: messageId not found in chat messages returns 404", async () => {
        const fakeChat = makeFakeEditChat();
        mockProjectFind.mockResolvedValue({
            _id: VALID_PROJECT_ID,
            edit_chat: VALID_EDIT_CHAT_ID,
        });
        mockChatFind.mockResolvedValue(fakeChat);

        const req = makeReq({
            projectId: VALID_PROJECT_ID,
            messageId: "99", // out-of-range index
            timelineItemId: VALID_TLI_ID,
        });
        const res = makeRes();

        await rollbackTimeline(req as Request, res as unknown as Response);

        expect(res._status).toBe(404);
        const body = res._json as { success: boolean; error: string };
        expect(body.success).toBe(false);
        expect(body.error).toMatch(/message not found/i);
    });

    it("422: message has no previousAssetId returns 422", async () => {
        const fakeChat = makeFakeEditChat({ hasPreviousAsset: false });
        mockProjectFind.mockResolvedValue({
            _id: VALID_PROJECT_ID,
            edit_chat: VALID_EDIT_CHAT_ID,
        });
        mockChatFind.mockResolvedValue(fakeChat);

        const req = makeReq({
            projectId: VALID_PROJECT_ID,
            messageId: "1",
            timelineItemId: VALID_TLI_ID,
        });
        const res = makeRes();

        await rollbackTimeline(req as Request, res as unknown as Response);

        expect(res._status).toBe(422);
        const body = res._json as { success: boolean; error: string };
        expect(body.success).toBe(false);
        expect(body.error).toMatch(/previousAssetId/i);
    });

    it("401: unauthenticated request returns 401", async () => {
        const req = makeReq(
            { projectId: VALID_PROJECT_ID, messageId: "1", timelineItemId: VALID_TLI_ID },
            null // no userId
        );
        const res = makeRes();

        await rollbackTimeline(req as Request, res as unknown as Response);

        expect(res._status).toBe(401);
        const body = res._json as { success: boolean; error: string };
        expect(body.success).toBe(false);
        expect(body.error).toMatch(/not authenticated/i);
    });
});

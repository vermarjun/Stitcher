import { Router } from "express";
import {
  addChatMessage,
  getChatMessages
} from "../controller/chat.controller";

const router = Router();

// Add a new message in a chat
router.post("/:chatId", addChatMessage);

// Get all messages for a chat
router.get("/:chatId", getChatMessages);


export default router;

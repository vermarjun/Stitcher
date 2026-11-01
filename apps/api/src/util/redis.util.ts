import { createClient } from 'redis';
import { Server } from 'socket.io';
import { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } from '../config';
import logger from './logger.util';

const redisUrl = REDIS_PASSWORD
    ? `redis://default:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`
    : `redis://${REDIS_HOST}:${REDIS_PORT}`;

export const redisSubscriber = createClient({
    url: redisUrl,
    socket: {
        // Never stop reconnecting: a transient DNS/network failure must not
        // permanently kill the pub/sub relay that drives live progress events.
        // Backoff capped at 5s; returning a number (not an Error) keeps retrying.
        reconnectStrategy: (retries: number) => Math.min(retries * 200, 5000),
        connectTimeout: 15_000,
        keepAlive: 30_000,
    },
});

redisSubscriber.on('error', (err) => logger.error({ message: 'Redis Client Error', error: String(err) }));
redisSubscriber.on('reconnecting', () => logger.warn({ message: 'Redis subscriber reconnecting…' }));
redisSubscriber.on('ready', () => logger.info({ message: 'Redis subscriber ready' }));

export const initRedisSubscriber = async (io: Server) => {
    try {
        await redisSubscriber.connect();
        logger.info('Redis subscriber connected');

        // Subscribe to all chat-related channels
        // We expect channels like: chat:{chatId}
        //
        // Single pSubscribe: relay each event to the chat's Socket.IO room.
        await redisSubscriber.pSubscribe('chat:*', (message, channel) => {
            const chatId = channel.split(':')[1];

            let parsedMessage: unknown = message;
            try {
                parsedMessage = JSON.parse(message) as unknown;
            } catch (_e) {
                // Non-JSON payload: relay the raw string.
            }

            io.to(chatId).emit('chat_update', parsedMessage);
        });
    } catch (error) {
        logger.error({ message: 'Failed to initialize Redis subscriber', error: String(error) });
    }
};

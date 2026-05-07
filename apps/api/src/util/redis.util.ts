import { createClient } from 'redis';
import { Server } from 'socket.io';
import { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } from '../config';
import logger from './logger.util';

const redisUrl = `redis://default:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`;

export const redisSubscriber = createClient({
    url: redisUrl
});

redisSubscriber.on('error', (err) => logger.error({ message: 'Redis Client Error', error: String(err) }));

export const initRedisSubscriber = async (io: Server) => {
    try {
        await redisSubscriber.connect();
        logger.info('Redis subscriber connected');

        // Subscribe to all chat-related channels
        // We expect channels like: chat:{chatId}
        await redisSubscriber.pSubscribe('chat:*', (message, channel) => {
            const chatId = channel.split(':')[1];

            try {
                // Try to parse JSON, otherwise send raw
                const parsedMessage = JSON.parse(message) as unknown;
                io.to(chatId).emit('chat_update', parsedMessage);
            } catch (_e) {
                io.to(chatId).emit('chat_update', message);
            }
        });
    } catch (error) {
        logger.error({ message: 'Failed to initialize Redis subscriber', error: String(error) });
    }
};

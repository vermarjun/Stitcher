from motor.motor_asyncio import AsyncIOMotorClient
from app.config.environment import MONGO_NAME, MONGO_URL

class MongoDB:
    def __init__(self):
        self.client = None
        self.db = None

    async def connect(self):
        print("Mongodb connection req came!")
        self.client = AsyncIOMotorClient(MONGO_URL)
        self.db = self.client[MONGO_NAME or ""]
        print("Mongodb connected!")

    async def close(self):
        if self.client:
            self.client.close()
        print("Mongodb disconnected!")

    async def get_db(self):
        if not self.client:
            await self.connect()
        return self.db

mongodb = MongoDB()
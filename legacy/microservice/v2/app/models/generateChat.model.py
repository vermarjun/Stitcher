from datetime import datetime
from typing import List, Optional, Union
from pydantic import BaseModel, Field
from bson import ObjectId


class PyObjectId(ObjectId):
    """Custom ObjectId type for Pydantic"""
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")


class Scene(BaseModel):
    """Model for Scene"""
    prompt: str
    code: str
    sceneName: str = Field(alias="sceneName")
    summary: str
    assetId: PyObjectId = Field(alias="assetId")
    error: Optional[str] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class AssistantContent(BaseModel):
    """Model for assistant message content"""
    plannerOutput: str = Field(alias="plannerOutput")
    llmResponse: str = Field(alias="llmResponse")

    class Config:
        populate_by_name = True


class GenerateChatMessage(BaseModel):
    """Model for individual messages in a chat"""
    role: str  # 'user' or 'assistant'
    content: Union[str, AssistantContent]
    timestamp: datetime = Field(default_factory=datetime.now)
    scenes: List[Scene] = Field(default_factory=list)
    projectDescription: str = Field(default="", alias="projectDescription")
    completed: bool = Field(default=False)
    plannerOut: bool = Field(default=False, alias="plannerOut")
    generatorOutput: bool = Field(default=False, alias="generatorOutput")

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class GenerateChat(BaseModel):
    """Model representing a Chat document in MongoDB"""
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    title: str
    messages: List[GenerateChatMessage] = Field(default_factory=list)
    projectId: PyObjectId = Field(alias="projectId")
    createdAt: Optional[datetime] = Field(default=None, alias="createdAt")
    updatedAt: Optional[datetime] = Field(default=None, alias="updatedAt")

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
        json_schema_extra = {
            "example": {
                "title": "My Project Chat",
                "messages": [],
                "projectId": "507f1f77bcf86cd799439011"
            }
        }


class GenerateChatInDB(GenerateChat):
    """Model for Chat document as stored in MongoDB"""
    id: PyObjectId = Field(alias="_id")

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
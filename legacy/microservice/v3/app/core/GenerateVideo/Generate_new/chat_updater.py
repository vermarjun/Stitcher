from typing import List, Dict, Any, Optional
from bson import ObjectId
from app.utils.connect_mongo import mongodb
import traceback
from datetime import datetime, timezone
from pydantic import BaseModel

class SceneObject(BaseModel):
    SceneName: str
    Prompt: str

class ChatUpdater:

    @staticmethod
    async def get_latest_assistant_message(chat_id: str):
        
        try:
            # Get database connection
            db = await mongodb.get_db()
            
            # Get collection
            collection = db.generatechats
            
            # Perform query
            chat = await collection.find_one({"_id": ObjectId(chat_id)})
            
            if not chat or "messages" not in chat:
                return None
            
            # Find the last assistant message
            for message in reversed(chat["messages"]):
                if message.get("role") == "assistant":
                    return message
            
            return None
            
        except Exception as e:
            print(f"Error getting latest assistant message: {str(e)}")
            return None
    
    @staticmethod
    async def update_planner_output(chat_id: str, planner_summary: str, scenes: List[SceneObject]):
        
        try:
            # Get database connection
            db = await mongodb.get_db()
            
            # Get collection
            collection = db.generatechats
            
            # Get current chat to find the last assistant message index
            chat = await collection.find_one({"_id": ObjectId(chat_id)})
            
            if not chat:
                print(f"No document found with id: {chat_id}")
                return False
            
            # Find the LAST assistant message index
            assistant_msg_index = None
            for idx in range(len(chat["messages"]) - 1, -1, -1):
                if chat["messages"][idx].get("role") == "assistant":
                    assistant_msg_index = idx
                    break
            
            if assistant_msg_index is None:
                print("No assistant message found")
                return False
            
            # Prepare scenes data
            scenes_data = [
                {
                    "sceneName": scene.SceneName,
                    "prompt": scene.Prompt,
                    "summary": "",
                    "code": None,
                    "assetId": None,
                    "error": None
                }
                for scene in scenes
            ]
            
            # Execute update using positional index instead of array filters
            update_query = {
                "$set": {
                    f"messages.{assistant_msg_index}.content.plannerOutput": planner_summary,
                    f"messages.{assistant_msg_index}.plannerOut": True,
                    f"messages.{assistant_msg_index}.scenes": scenes_data
                }
            }
            
            result = await collection.update_one(
                {"_id": ObjectId(chat_id)},
                update_query
            )
            
            if result.matched_count == 0:
                print(f"No document found with id: {chat_id}")
                return False
            elif result.modified_count == 0:
                print(f"Document found but no modifications made for chat_id: {chat_id}")
                return False
            
            print(f"Successfully updated planner output for chat_id: {chat_id}")
            return True
            
        except Exception as e:
            print(f"Error updating planner output for chat {chat_id}: {str(e)}")
            traceback.print_exc()
            return False
    
    @staticmethod
    async def update_generator_output(chat_id: str, scenes_with_code: List[Dict[str, Any]]):
        
        try:
            # Get database connection
            db = await mongodb.get_db()
            
            # Get collection
            collection = db.generatechats
            
            # Get current chat
            chat = await collection.find_one({"_id": ObjectId(chat_id)})
            print("chat found!")
            
            if not chat:
                print("chat nahi mili, returning")
                return False
            
            # Find the LAST assistant message (iterate backwards)
            assistant_msg_index = None
            for idx in range(len(chat["messages"]) - 1, -1, -1):
                if chat["messages"][idx].get("role") == "assistant":
                    assistant_msg_index = idx
                    break
            
            print("message index found!", assistant_msg_index)
            
            if assistant_msg_index is None:
                print("message index not found!")
                return False
            
            # Get current scenes
            scenes = chat["messages"][assistant_msg_index].get("scenes", [])
            print("Scenes found", scenes)
            
            # Update scenes with code
            updated_count = 0
            for scene_update in scenes_with_code:
                scene_name = scene_update["sceneName"]
                for scene in scenes:
                    if scene["sceneName"] == scene_name:
                        scene["code"] = scene_update["code"]
                        updated_count += 1
                        break
            print("updated_count: ", updated_count)
            
            # Execute update
            update_query = {
                "$set": {
                    f"messages.{assistant_msg_index}.scenes": scenes,
                    f"messages.{assistant_msg_index}.generatorOutput": True
                }
            }
            print("update_query: ", update_query)
            
            result = await collection.update_one(
                {"_id": ObjectId(chat_id)},
                update_query
            )
            print(result)
            
            if result.modified_count > 0:
                print(f"Successfully updated generator output for chat_id: {chat_id}")
                return True
            else:
                print(f"No modifications made for chat_id: {chat_id}")
                return False
            
        except Exception as e:
            print(f"Error updating generator output for chat {chat_id}: {str(e)}")
            traceback.print_exc()
            return False
    
    @staticmethod
    async def update_scene_code(chat_id: str, scene_name: str, new_code: str, scene_description: Optional[str] = ""):
        
        try:
            # Get database connection
            db = await mongodb.get_db()
            
            # Get collection
            collection = db.generatechats
            
            # Get current chat to find the last assistant message index
            chat = await collection.find_one({"_id": ObjectId(chat_id)})
            
            if not chat:
                print(f"No document found with id: {chat_id}")
                return False
            
            # Find the LAST assistant message index
            assistant_msg_index = None
            for idx in range(len(chat["messages"]) - 1, -1, -1):
                if chat["messages"][idx].get("role") == "assistant":
                    assistant_msg_index = idx
                    break
            
            if assistant_msg_index is None:
                print("No assistant message found")
                return False
            
            # Find the scene index within that message
            scenes = chat["messages"][assistant_msg_index].get("scenes", [])
            scene_index = None
            for idx, scene in enumerate(scenes):
                if scene.get("sceneName") == scene_name:
                    scene_index = idx
                    break
            
            if scene_index is None:
                print(f"Scene {scene_name} not found in last assistant message")
                return False
            
            # Update using positional index
            update_query = {
                "$set": {
                    f"messages.{assistant_msg_index}.scenes.{scene_index}.code": new_code
                }
            }
            
            result = await collection.update_one(
                {"_id": ObjectId(chat_id)},
                update_query
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error updating scene code: {str(e)}")
            traceback.print_exc()
            return False
    
    @staticmethod
    async def update_scene_render(
        code: str,
        chat_id: str, 
        scene_name: str, 
        scene_description: str,
        project_id: str,
        metadata: Dict[str, Any]
    ):
        try:
            # Get database connection
            db = await mongodb.get_db()
            
            # Step 1: Create Asset document
            assets_collection = db.assets
            
            asset_doc = {
                "name": f"{scene_name}_video",  
                "type": "video",  
                "code": code,
                "scene_name": scene_name,
                "scene_description": scene_description,
                "origin": "generated_video",  
                "url": metadata.get("url"),
                "thumbnail": metadata.get("thumbnail", ""),
                "duration": metadata.get("duration"),
                "width": metadata.get("width"),
                "height": metadata.get("height"),
                "bytes": metadata.get("bytes", 0),
                "metadata": {
                    "public_id": metadata.get("public_id"),
                    "cloudinary_metadata": metadata 
                },
                "projectId": ObjectId(project_id),
                "isOnTimeline": False,
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            }
            
            # Insert the asset
            asset_result = await assets_collection.insert_one(asset_doc)
            # print("\n ########&&&&&&&&&&&&**********((((((((((((((((((99(((((((((((())))))))))))))))))))))))))))))")
            # print(asset_result)
            asset_id = asset_result.inserted_id
            # print(asset_id)
            
            # Step 2: Get current chat to find the last assistant message index
            generatechats_collection = db.generatechats
            chat = await generatechats_collection.find_one({"_id": ObjectId(chat_id)})
            
            if not chat:
                # Rollback: delete the created asset
                await assets_collection.delete_one({"_id": asset_id})
                print(f"No document found with id: {chat_id}")
                return False
            
            # Find the LAST assistant message index
            assistant_msg_index = None
            for idx in range(len(chat["messages"]) - 1, -1, -1):
                if chat["messages"][idx].get("role") == "assistant":
                    assistant_msg_index = idx
                    break
            
            if assistant_msg_index is None:
                # Rollback: delete the created asset
                await assets_collection.delete_one({"_id": asset_id})
                print("No assistant message found")
                return False
            
            # Find the scene index within that message
            scenes = chat["messages"][assistant_msg_index].get("scenes", [])
            scene_index = None
            for idx, scene in enumerate(scenes):
                if scene.get("sceneName") == scene_name:
                    scene_index = idx
                    break
            
            if scene_index is None:
                # Rollback: delete the created asset
                await assets_collection.delete_one({"_id": asset_id})
                print(f"Scene {scene_name} not found in last assistant message")
                return False
            
            # Update using positional index
            update_query = {
                "$set": {
                    f"messages.{assistant_msg_index}.scenes.{scene_index}.assetId": asset_id,
                    f"messages.{assistant_msg_index}.scenes.{scene_index}.error": None
                }
            }
            
            result = await generatechats_collection.update_one(
                {"_id": ObjectId(chat_id)},
                update_query
            )
            
            if result.matched_count == 0:
                # Rollback: delete the created asset if chat update failed
                await assets_collection.delete_one({"_id": asset_id})
                return False
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error in update_scene_render: {str(e)}")
            traceback.print_exc()
            return False
    
    @staticmethod
    async def update_scene_error(chat_id: str, scene_name: str, error: str):
        
        try:
            # Get database connection
            db = await mongodb.get_db()
            
            # Get collection
            collection = db.generatechats
            
            # Get current chat to find the last assistant message index
            chat = await collection.find_one({"_id": ObjectId(chat_id)})
            
            if not chat:
                print(f"No document found with id: {chat_id}")
                return False
            
            # Find the LAST assistant message index
            assistant_msg_index = None
            for idx in range(len(chat["messages"]) - 1, -1, -1):
                if chat["messages"][idx].get("role") == "assistant":
                    assistant_msg_index = idx
                    break
            
            if assistant_msg_index is None:
                print("No assistant message found")
                return False
            
            # Find the scene index within that message
            scenes = chat["messages"][assistant_msg_index].get("scenes", [])
            scene_index = None
            for idx, scene in enumerate(scenes):
                if scene.get("sceneName") == scene_name:
                    scene_index = idx
                    break
            
            if scene_index is None:
                print(f"Scene {scene_name} not found in last assistant message")
                return False
            
            # Update using positional index
            update_query = {
                "$set": {
                    f"messages.{assistant_msg_index}.scenes.{scene_index}.error": error
                }
            }
            
            result = await collection.update_one(
                {"_id": ObjectId(chat_id)},
                update_query
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error updating scene error: {str(e)}")
            traceback.print_exc()
            return False
    
    from bson import ObjectId

    @staticmethod
    async def update_final_response(chat_id: str, llm_response: str):
        try:
            # Get database connection
            db = await mongodb.get_db()

            # Collections
            collection = db.generatechats
            users_col = db.users

            # Get current chat to find the last assistant message index
            chat = await collection.find_one({"_id": ObjectId(chat_id)})

            if not chat:
                print(f"No document found with id: {chat_id}")
                return False

            # Find the LAST assistant message index
            assistant_msg_index = None
            for idx in range(len(chat.get("messages", [])) - 1, -1, -1):
                if chat["messages"][idx].get("role") == "assistant":
                    assistant_msg_index = idx
                    break

            if assistant_msg_index is None:
                print("No assistant message found")
                return False

            # Use conditional update so we only set completed=True when it wasn't already True.
            # This protects against double-charging when this function is called multiple times.
            filter_doc = {
                "_id": ObjectId(chat_id),
                f"messages.{assistant_msg_index}.completed": {"$ne": True}
            }
            update_query = {
                "$set": {
                    f"messages.{assistant_msg_index}.content.llmResponse": llm_response,
                    f"messages.{assistant_msg_index}.completed": True
                }
            }

            result = await collection.update_one(filter_doc, update_query)

            if result.modified_count > 0:
                print(f"Successfully updated final response for chat_id: {chat_id}")

                # Attempt to deduct 1 generation credit from the user
                try:
                    user_id = chat.get("userId")
                    if not user_id:
                        print(f"⚠ No userId on chat {chat_id} — cannot deduct generation credit.")
                    else:
                        # Normalize to ObjectId if needed (handles populated user or string)
                        user_obj_id = None
                        if isinstance(user_id, ObjectId):
                            user_obj_id = user_id
                        elif isinstance(user_id, dict) and user_id.get("_id"):
                            try:
                                user_obj_id = ObjectId(user_id["_id"])
                            except Exception:
                                # if it's already ObjectId-like, fallback
                                user_obj_id = user_id["_id"]
                        else:
                            try:
                                user_obj_id = ObjectId(user_id)
                            except Exception:
                                print(f"✗ Invalid userId format: {user_id}")
                                user_obj_id = None

                        if user_obj_id:
                            user_update = await users_col.update_one(
                                {
                                    "_id": user_obj_id,
                                    "credits.generation": {"$gt": 0},
                                    "isTestAccount": {"$ne": True}
                                },
                                {"$inc": {"credits.generation": -1}}
                            )

                            if user_update.modified_count > 0:
                                print(f"✓ Deducted 1 generation credit from user {user_obj_id}")
                            else:
                                # Try to fetch user doc for diagnostics
                                user_doc = await users_col.find_one({"_id": user_obj_id}, {"credits": 1, "isTestAccount": 1})
                                if user_doc and user_doc.get("isTestAccount"):
                                    print(f"⚠ User {user_obj_id} is a test account — skipping generation credit deduction.")
                                elif user_doc and user_doc.get("credits", {}).get("generation", 0) <= 0:
                                    print(f"⚠ User {user_obj_id} has no generation credits to deduct.")
                                else:
                                    print(f"⚠ Could not deduct generation credit for user {user_obj_id}. (Unknown reason)")
                except Exception as e:
                    print(f"✗ Error while deducting generation credit: {str(e)}")
                    traceback.print_exc()

                return True
            else:
                # No modification => either completed already True, or no change required
                print(f"No modifications made for chat_id: {chat_id} (maybe already completed)")
                return False

        except Exception as e:
            print(f"Error updating final response: {str(e)}")
            traceback.print_exc()
            return False

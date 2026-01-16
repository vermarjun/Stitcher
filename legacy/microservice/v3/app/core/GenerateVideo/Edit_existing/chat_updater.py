from typing import Dict, Any, Optional
from bson import ObjectId
from app.utils.connect_mongo import mongodb
import traceback
from datetime import datetime, timezone

class ChatUpdater:

    @staticmethod
    async def get_latest_assistant_message(chat_id: str) -> Optional[Dict]:
        """Get the most recent assistant message from a chat"""
        try:
            db = await mongodb.get_db()
            collection = db.generatechats
            
            chat = await collection.find_one({"_id": ObjectId(chat_id)})
            
            if not chat or "messages" not in chat:
                return None
            
            for message in reversed(chat["messages"]):
                if message.get("role") == "assistant":
                    return message
            
            return None
            
        except Exception as e:
            print(f"Error getting latest assistant message: {str(e)}")
            traceback.print_exc()
            return None
    
    @staticmethod
    async def _get_assistant_message_index(chat_id: str) -> tuple[Optional[Dict], Optional[int]]:

        try:
            db = await mongodb.get_db()
            collection = db.generatechats
            
            chat = await collection.find_one({"_id": ObjectId(chat_id)})
            
            if not chat or "messages" not in chat:
                return None, None
            
            for idx in range(len(chat["messages"]) - 1, -1, -1):
                if chat["messages"][idx].get("role") == "assistant":
                    return chat, idx
            
            return chat, None
            
        except Exception as e:
            print(f"Error finding assistant message: {str(e)}")
            traceback.print_exc()
            return None, None
    
    @staticmethod
    async def update_generator_output(
        chat_id: str, 
        scene_name: str,
        scene_description: str,
        code: str
    ) -> bool:
        
        try:
            chat, assistant_msg_index = await ChatUpdater._get_assistant_message_index(chat_id)
            
            if chat is None or assistant_msg_index is None:
                print(f"No assistant message found in chat {chat_id}")
                return False
            
            scene_data = {
                "sceneName": scene_name,
                "prompt": "",
                "summary": scene_description,
                "code": code,
                "assetId": None,
                "error": None
            }
            
            db = await mongodb.get_db()
            collection = db.generatechats
            
            update_query = {
                "$set": {
                    f"messages.{assistant_msg_index}.scenes": [scene_data],
                    f"messages.{assistant_msg_index}.generatorOutput": True
                }
            }
            
            result = await collection.update_one(
                {"_id": ObjectId(chat_id)},
                update_query
            )
            
            if result.modified_count > 0:
                print(f"✓ Updated generator output for {scene_name}")
                return True
            else:
                print(f"⚠ No modifications made for chat_id: {chat_id}")
                return False
            
        except Exception as e:
            print(f"✗ Error updating generator output: {str(e)}")
            traceback.print_exc()
            return False
    
    @staticmethod
    async def update_scene_code(
        chat_id: str, 
        scene_name: str,
        scene_description: str,
        new_code: str
    ) -> bool:

        try:
            chat, assistant_msg_index = await ChatUpdater._get_assistant_message_index(chat_id)
            
            if chat is None or assistant_msg_index is None:
                return False
            
            scenes = chat["messages"][assistant_msg_index].get("scenes", [])
            
            scene_updated = False
            for scene in scenes:
                if scene.get("sceneName") == scene_name:
                    scene["code"] = new_code
                    scene["prompt"] = scene_description
                    scene_updated = True
                    break
            
            if not scene_updated:
                print(f"Scene {scene_name} not found, cannot update code")
                return False
            
            db = await mongodb.get_db()
            collection = db.generatechats
            
            update_query = {
                "$set": {
                    f"messages.{assistant_msg_index}.scenes": scenes
                }
            }
            
            result = await collection.update_one(
                {"_id": ObjectId(chat_id)},
                update_query
            )
            
            if result.modified_count > 0:
                print(f"✓ Updated code for {scene_name}")
                return True
            
            return False
            
        except Exception as e:
            print(f"✗ Error updating scene code: {str(e)}")
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
    ) -> bool:

        asset_id = None
        try:
            db = await mongodb.get_db()
            assets_collection = db.assets
            
            asset_doc = {
                "name": f"{scene_name}_edited",
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
            
            asset_result = await assets_collection.insert_one(asset_doc)
            asset_id = asset_result.inserted_id
            print(f"✓ Created asset document: {asset_id}")
            
            chat, assistant_msg_index = await ChatUpdater._get_assistant_message_index(chat_id)
            
            if chat is None or assistant_msg_index is None:
                raise Exception("No assistant message found")
            
            scenes = chat["messages"][assistant_msg_index].get("scenes", [])
            
            scene_found = False
            for scene in scenes:
                if scene.get("sceneName") == scene_name:
                    scene["assetId"] = asset_id
                    scene["error"] = None
                    scene_found = True
                    break
            
            if not scene_found:
                raise Exception(f"Scene {scene_name} not found in chat")
            
            generatechats_collection = db.generatechats
            
            update_query = {
                "$set": {
                    f"messages.{assistant_msg_index}.scenes": scenes
                }
            }
            
            result = await generatechats_collection.update_one(
                {"_id": ObjectId(chat_id)},
                update_query
            )
            
            if result.modified_count > 0:
                print(f"✓ Updated scene with assetId: {scene_name}")
                return True
            else:
                raise Exception("Failed to update chat with assetId")
            
        except Exception as e:
            print(f"✗ Error in update_scene_render: {str(e)}")
            traceback.print_exc()
            
            if asset_id:
                try:
                    db = await mongodb.get_db()
                    await db.assets.delete_one({"_id": asset_id})
                    print(f"⚠ Rolled back asset creation: {asset_id}")
                except:
                    print(f"⚠ Failed to rollback asset: {asset_id}")
            
            return False
    
    @staticmethod
    async def update_scene_error(
        chat_id: str, 
        scene_name: str, 
        error: str
    ) -> bool:

        try:
            chat, assistant_msg_index = await ChatUpdater._get_assistant_message_index(chat_id)
            
            if chat is None or assistant_msg_index is None:
                return False
            
            scenes = chat["messages"][assistant_msg_index].get("scenes", [])
            
            scene_found = False
            for scene in scenes:
                if scene.get("sceneName") == scene_name:
                    scene["error"] = error
                    scene["assetId"] = None
                    scene_found = True
                    break
            
            if not scene_found:
                print(f"Scene {scene_name} not found")
                return False
            
            db = await mongodb.get_db()
            collection = db.generatechats
            
            update_query = {
                "$set": {
                    f"messages.{assistant_msg_index}.scenes": scenes
                }
            }
            
            result = await collection.update_one(
                {"_id": ObjectId(chat_id)},
                update_query
            )
            
            if result.modified_count > 0:
                print(f"✓ Updated error for {scene_name}")
                return True
            
            return False
            
        except Exception as e:
            print(f"✗ Error updating scene error: {str(e)}")
            traceback.print_exc()
            return False
    
    @staticmethod
    async def update_final_response(
        chat_id: str, 
        llm_response: str
    ) -> bool:

        try:
            chat, assistant_msg_index = await ChatUpdater._get_assistant_message_index(chat_id)
            
            if chat is None or assistant_msg_index is None:
                print(f"No assistant message found in chat {chat_id}")
                return False
            
            db = await mongodb.get_db()
            collection = db.generatechats
            
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
                print(f"✓ Chat marked as completed: {chat_id}")

                # --- Attempt to deduct 1 editing credit from the user ---
                try:
                    user_id = chat.get("userId")
                    if user_id:
                        users_col = db.users
                        
                        # Normalize to ObjectId if needed (handles populated user or string)
                        user_obj_id = None
                        if isinstance(user_id, ObjectId):
                            user_obj_id = user_id
                        elif isinstance(user_id, dict) and user_id.get("_id"):
                            try:
                                user_obj_id = ObjectId(user_id["_id"])
                            except Exception:
                                user_obj_id = user_id["_id"]
                        else:
                            try:
                                user_obj_id = ObjectId(user_id)
                            except Exception:
                                print(f"✗ Invalid userId format: {user_id}")
                                user_obj_id = None
                        
                        if user_obj_id:
                            # Only decrement if editing credits > 0 and not a test account
                            user_update = await users_col.update_one(
                                {
                                    "_id": user_obj_id,
                                    "credits.editing": {"$gt": 0},
                                    "isTestAccount": {"$ne": True}
                                },
                                {"$inc": {"credits.editing": -1}}
                            )

                            if user_update.modified_count > 0:
                                print(f"✓ Deducted 1 editing credit from user {user_obj_id}")
                            else:
                                # Provide helpful diagnostics
                                user_doc = await users_col.find_one({"_id": user_obj_id}, {"credits": 1, "isTestAccount": 1})
                                if user_doc and user_doc.get("isTestAccount"):
                                    print(f"⚠ User {user_obj_id} is a test account — skipping credit deduction.")
                                elif user_doc and user_doc.get("credits", {}).get("editing", 0) <= 0:
                                    print(f"⚠ User {user_obj_id} has no editing credits to deduct.")
                                else:
                                    print(f"⚠ Could not deduct editing credit for user {user_obj_id}. (Unknown reason)")
                    else:
                        print(f"⚠ No userId found on chat {chat_id} — can't deduct credits.")
                except Exception as e:
                    print(f"✗ Error while deducting editing credit: {str(e)}")
                    traceback.print_exc()

                return True
            else:
                # No modification => either completed already True, or no change required
                print(f"⚠ No modifications made for chat_id: {chat_id} (maybe already completed)")
                return False
            
        except Exception as e:
            print(f"✗ Error updating final response: {str(e)}")
            traceback.print_exc()
            return False


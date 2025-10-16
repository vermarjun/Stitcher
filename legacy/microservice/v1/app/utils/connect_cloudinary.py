import cloudinary

from config.environment import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_SECRET, CLOUDINARY_API_KEY

def connect_cloudinary():
    cloudinary.config(
        cloud_name = CLOUDINARY_CLOUD_NAME,
        api_key = CLOUDINARY_API_KEY,
        api_secret = CLOUDINARY_API_SECRET,
        secure=True
    )
    print("Cloudinary connected!")
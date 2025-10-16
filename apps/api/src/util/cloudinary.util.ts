import { v2 as cloudinary } from 'cloudinary';
import { CLOUDINARY_CONFIG } from '../config';

cloudinary.config(CLOUDINARY_CONFIG);

export default cloudinary;

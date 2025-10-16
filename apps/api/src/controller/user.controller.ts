import { Request, Response } from 'express';
import User from '../model/user.model';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import sendMail from '../util/mailer.util';
import { JWT_CONFIG, PASSWORD_RESET_CONFIG } from '../config';
import cloudinary from '../util/cloudinary.util';

interface IUserRequest extends Request {
  userId?: string;
  body: {
    username?: string;
    email?: string;
    password?: string;
    currentPassword?: string;
    newPassword?: string;
    bio?: string;
    [key: string]: any;
  };
}

interface IUserResponse extends Response {
  [key: string]: any;
}

interface IUser {
  _id: string;
  username: string;
  email: string;
  password: string;
  bio?: string;
  profilePhoto?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: number;
  [key: string]: any;
}

export const signup = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    return res.status(201).json({ message: 'User created successfully.' });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const login = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const user: IUser | null = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'User Not Found!' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign({ userId: user._id.toString() }, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.expiresIn } as jwt.SignOptions);
    return res.status(200).json({ 
      token, 
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email,
        plan: user.plan,
        role: user.role,
        bio: user.bio,
        profilePhoto: user.profilePhoto
      } 
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const getUser = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const user: IUser | null = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json(user);
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const updateUser = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const updates = req.body;
    if (updates.password) delete updates.password; // Prevent password update here

    const user: IUser | null = await User.findByIdAndUpdate(
      req.userId, 
      updates, 
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json(user);
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const changePassword = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }
    
    const user: IUser | null = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    
    return res.status(200).json({ message: 'Password changed successfully.' });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const uploadProfilePhoto = async (req: any, res: Response): Promise<Response> => {
  try {
    const user: IUser | null = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    // Upload buffer to cloudinary
    const uploadResult = await cloudinary.uploader.upload_stream(
      { folder: 'profile_photos', public_id: user._id.toString(), overwrite: true },
      async (error, result) => {
        if (error || !result) {
          return res.status(500).json({ message: 'Cloudinary upload failed.', error });
        }

        user.profilePhoto = result.secure_url;
        await user.save();

        return res.status(200).json({
          message: 'Profile photo uploaded successfully.',
          profilePhoto: result.secure_url,
        });
      }
    );

    // Pipe file buffer into Cloudinary upload_stream
    if (req.file && req.file.buffer) {
      const stream = uploadResult;
      stream.end(req.file.buffer);
    }

    return res; // prevents TS warnings
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const deleteUser = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const user: IUser | null = await User.findByIdAndDelete(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.status(200).json({ message: 'User deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const requestPasswordReset = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });
    
    const user: IUser | null = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    
    const resetToken = crypto.randomBytes(PASSWORD_RESET_CONFIG.tokenLength).toString('hex');
    const resetTokenExpiry = Date.now() + PASSWORD_RESET_CONFIG.tokenExpiry;
    
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();
    
    const resetLink = `${req.protocol}://${req.get('host')}/api/users/reset-password/${resetToken}`;
    
    await sendMail({
      to: user.email,
      subject: 'Password Reset Request',
      text: `Reset your password using this link: ${resetLink}`,
      html: `<p>You requested a password reset.</p><p><a href="${resetLink}">Click here to reset your password</a></p><p>If you did not request this, please ignore this email.</p>`,
    });
    
    return res.status(200).json({ message: 'Password reset link sent to your email.' });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const resetPassword = async (req: IUserRequest, res: IUserResponse): Promise<Response> => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    if (!password) return res.status(400).json({ message: 'Password is required.' });
    
    const user: IUser | null = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    
    if (!user) return res.status(400).json({ message: 'Invalid or expired token.' });
    
    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    return res.status(200).json({ message: 'Password reset successful.' });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};
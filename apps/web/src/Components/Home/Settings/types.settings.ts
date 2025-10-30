export interface UserData {
  id: string;
  username: string;
  email: string;
  bio?: string;
  profilePhoto?: string;
  plan?: string;
  role?: string;
}

export interface FormData {
  username: string;
  email: string;
  bio: string;
}

export interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ShowPasswords {
  current: boolean;
  new: boolean;
  confirm: boolean;
}

export interface Message {
  type: "success" | "error";
  text: string;
}
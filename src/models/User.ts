import mongoose from "mongoose";

export interface IUser {
  _id?: string;
  openId: string;
  name?: string | null;
  email?: string | null;
  passwordHash?: string | null;
  loginMethod?: string | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    openId: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    email: { type: String, index: true, sparse: true },
    passwordHash: { type: String },
    loginMethod: { type: String },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    lastSignedIn: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);

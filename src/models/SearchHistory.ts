import mongoose from "mongoose";

export interface ISearchHistory {
  _id?: string;
  userId: string;
  musicBrainzId?: string;
  title: string;
  artist: string;
  releaseDate?: string;
  coverUrl?: string;
  createdAt: Date;
}

const searchHistorySchema = new mongoose.Schema<ISearchHistory>(
  {
    userId: { type: String, required: true, index: true },
    musicBrainzId: { type: String },
    title: { type: String, required: true },
    artist: { type: String, required: true },
    releaseDate: { type: String },
    coverUrl: { type: String },
  },
  { timestamps: true }
);

export const SearchHistory = mongoose.model<ISearchHistory>(
  "SearchHistory",
  searchHistorySchema
);

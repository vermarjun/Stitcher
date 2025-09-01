import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Music,
  FileText,
  Layers,
  Plus,
  Upload,
  Filter,
  Loader2,
} from "lucide-react";
import type { Asset, ITrack, Project } from "@/State/Types";
import { AssetOrigin, AssetType } from "@/State/Types";
import api from "@/api";
import { toast } from "sonner";
import BeautifulLoader from "@/Components/LoadingScreens/Templatestore.loader.tsx";
import { useRefresh } from "../RefreshContextProvider.tsx";

interface Props {
  currentProject?: Project;
}

interface UploadProgress {
  [key: string]: {
    progress: number;
    status: "uploading" | "processing" | "complete" | "error";
  };
}

const AssetStashSidebar = ({ currentProject }: Props) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filter, setFilter] = useState<"all" | "video" | "audio">("all");
  const [originFilter, setOriginFilter] = useState<AssetOrigin | "all">("all");
  const [showOriginFilter, setShowOriginFilter] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { refreshKey } = useRefresh();

  async function fetchAssets() {
    try {
      setIsLoading(true);

      const assetResponse = await api.get(
        `/asset/project/${currentProject?._id}`
      );

      if (assetResponse.status === 200 || assetResponse.status === 201) {
        setAssets(assetResponse.data.data);
      } else {
        throw new Error(
          assetResponse.data?.message || "Failed to fetch project"
        );
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch assets";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchAssets();
  },[refreshKey]);

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
  };

  const getOriginIcon = (origin: AssetOrigin) => {
    switch (origin) {
      case AssetOrigin.TEMPLATE:
        return <FileText className="w-3 h-3" />;
      case AssetOrigin.UPLOAD:
        return <Layers className="w-3 h-3" />;
      case AssetOrigin.GENERATED_VIDEO:
        return <Play className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getOriginLabel = (origin: AssetOrigin): string => {
    switch (origin) {
      case AssetOrigin.TEMPLATE:
        return "Template";
      case AssetOrigin.UPLOAD:
        return "Upload";
      case AssetOrigin.GENERATED_VIDEO:
        return "AI Generated";
      default:
        return "";
    }
  };

const handleAddToTimeline = async (asset: Asset) => {
  try {
    // Determine asset type and find matching track
    let assetType: string;
    let trackId: string | null = null;

    if (asset.type === 'video') {
      assetType = 'video';
    } else if (asset.type === 'audio') {
      assetType = 'audio';
    } else if (asset.type === 'image') {
      // Images typically go to video track
      assetType = 'video';
    } else {
      toast.error('Unsupported asset type');
      return;
    }

    // Find the track that matches the asset type
    const matchingTrack = currentProject?.timeline.tracks.find(
      (track:ITrack) => track.type === assetType
    );

    if (!matchingTrack) {
      toast.error(`No ${assetType} track found`);
      return;
    }

    trackId = matchingTrack._id;

    // Prepare request body
    const requestBody = {
      assetId: asset._id,
      sourceStartTime: 0,
      sourceEndTime: asset.duration,
      speed: 1,
      volume: 1,
      opacity: 1,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      fadeIn: 0,
      fadeOut: 0
    };

    // Make API request
    const response = await api.post(`/track/${trackId}/asset`, requestBody);

    // Check if response indicates success
    if (response.data?.success) {
      toast.success("Successfully Added to timeline");
    } else {
      // Display error message from response
      const errorMessage = response.data?.message || 'Failed to add asset to timeline';
      toast.error(errorMessage);
    }
  } catch (error: any) {
    // Handle network errors or other exceptions
    const errorMessage = error.response?.data?.message || error.message || 'An unexpected error occurred';
    toast.error(errorMessage);
  }
};
  const uploadFileToCloudinary = async (
    file: File,
    uploadParams: any,
    signature: string,
    apiKey: string,
    cloudName: string,
    fileId: string
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("signature", signature);
    formData.append("api_key", apiKey);
    formData.append("timestamp", uploadParams.timestamp.toString());
    formData.append("folder", uploadParams.folder);
    formData.append("resource_type", uploadParams.resource_type);
    formData.append("quality", uploadParams.quality);
    formData.append("fetch_format", uploadParams.fetch_format);

    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress((prev) => ({
            ...prev,
            [fileId]: { ...prev[fileId], progress },
          }));
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error("Failed to parse response"));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Upload failed"));
      });

      xhr.open(
        "POST",
        `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`
      );
      xhr.send(formData);
    });
  };

  const processUploadedFile = async (file: File, fileId: string) => {
    try {
      const isVideo = file.type.startsWith("video/");
      // const isAudio = file.type.startsWith("audio/");
      const resourceType = isVideo ? "video" : "audio";

      setUploadProgress((prev) => ({
        ...prev,
        [fileId]: { progress: 0, status: "uploading" },
      }));

      // Step 1: Get upload signature
      const signatureResponse = await api.post("/asset/upload-signature", {
        projectId: currentProject?._id, // You might want to make this dynamic
        resourceType,
      });

      console.log(signatureResponse.data);

      const { signature, cloudName, apiKey, uploadParams } =
        signatureResponse.data;

      // Step 2: Upload to Cloudinary
      const cloudinaryResponse: any = await uploadFileToCloudinary(
        file,
        uploadParams,
        signature,
        apiKey,
        cloudName,
        fileId
      );

      console.log(cloudinaryResponse);

      setUploadProgress((prev) => ({
        ...prev,
        [fileId]: { progress: 100, status: "processing" },
      }));

      // Step 3: Save metadata to backend
      const metadataPayload = {
        name: file.name,
        type: resourceType,
        url: cloudinaryResponse.secure_url,
        thumbnail: isVideo
          ? cloudinaryResponse.secure_url.replace(
              "/video/upload/",
              "/video/upload/w_400,h_120,c_fill/"
            )
          : "",
        duration: cloudinaryResponse.duration || undefined,
        width: cloudinaryResponse.width || undefined,
        height: cloudinaryResponse.height || undefined,
        bytes: cloudinaryResponse.bytes,
        metadata: {
          format: cloudinaryResponse.format,
          originalFilename: cloudinaryResponse.original_filename,
        },
        projectId: "project1",
        cloudinaryPublicId: cloudinaryResponse.public_id,
      };
      console.log(metadataPayload);
      const metadataResponse = await api.post(
        "/asset/save-metadata",
        metadataPayload
      );
      console.log(metadataResponse);

      // Add the new asset to the local state
      const newAsset: Asset = {
        _id: metadataResponse.data.asset._id,
        name: file.name,
        type: isVideo ? AssetType.VIDEO : AssetType.AUDIO,
        origin: AssetOrigin.UPLOAD,
        url: cloudinaryResponse.secure_url,
        thumbnail: isVideo
          ? cloudinaryResponse.secure_url.replace(
              "/video/upload/",
              "/video/upload/w_400,h_120,c_fill/"
            )
          : "",
        duration: cloudinaryResponse.duration || undefined,
        width: cloudinaryResponse.width || undefined,
        height: cloudinaryResponse.height || undefined,
        bytes: cloudinaryResponse.bytes,
        metadata: metadataResponse.data.asset.metadata,
        projectId: "project1",
        createdAt: metadataResponse.data.asset.createdAt,
        updatedAt: metadataResponse.data.asset.updatedAt,
      };

      setAssets((prev) => [newAsset, ...prev]);

      setUploadProgress((prev) => ({
        ...prev,
        [fileId]: { progress: 100, status: "complete" },
      }));

      // Remove progress after a delay
      setTimeout(() => {
        setUploadProgress((prev) => {
          const { [fileId]: removed, ...rest } = prev;
          return rest;
        });
      }, 2000);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadProgress((prev) => ({
        ...prev,
        [fileId]: { progress: 0, status: "error" },
      }));

      // Remove error status after delay
      setTimeout(() => {
        setUploadProgress((prev) => {
          const { [fileId]: removed, ...rest } = prev;
          return rest;
        });
      }, 3000);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file, index) => {
      const isVideo = file.type.startsWith("video/");
      const isAudio = file.type.startsWith("audio/");

      if (!isVideo && !isAudio) return;

      const fileId = `upload_${Date.now()}_${index}`;
      processUploadedFile(file, fileId);
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    files.forEach((file, index) => {
      const isVideo = file.type.startsWith("video/");
      const isAudio = file.type.startsWith("audio/");

      if (!isVideo && !isAudio) return;

      const fileId = `drop_${Date.now()}_${index}`;
      processUploadedFile(file, fileId);
    });
  };

  const filteredAssets = assets.filter((asset) => {
    const typeMatch = filter === "all" || asset.type === filter;
    const originMatch = originFilter === "all" || asset.origin === originFilter;
    return typeMatch && originMatch;
  });

  const hasActiveUploads = Object.keys(uploadProgress).length > 0;

  if (isLoading) return <BeautifulLoader/>;

  return (
    <div className="bg-black border-r border-zinc-800 h-screen flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800">
        {/* <h2 className="text-base font-semibold text-white mb-2">Asset Stash</h2> */}
        {/* Filter Tabs */}
        <div className="flex bg-zinc-900 rounded-lg p-1 mb-2">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("video")}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === "video"
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Video
          </button>
          <button
            onClick={() => setFilter("audio")}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === "audio"
                ? "bg-white text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Audio
          </button>
        </div>
        {/* Origin Filter Button */}
        <div className="relative">
          <button
            onClick={() => setShowOriginFilter(!showOriginFilter)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-xs text-zinc-300 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3" />
              <span>Filter by Origin</span>
            </div>
            <span className="text-[10px] text-zinc-500">
              {originFilter === "all"
                ? "All"
                : getOriginLabel(originFilter as AssetOrigin)}
            </span>
          </button>
          {/* Origin Filter Dropdown */}
          {showOriginFilter && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 rounded-lg border border-zinc-700 z-10">
              <button
                onClick={() => {
                  setOriginFilter("all");
                  setShowOriginFilter(false);
                }}
                className="w-full px-2.5 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700 transition-colors rounded-t-lg"
              >
                All Origins
              </button>
              {Object.values(AssetOrigin).map((origin) => (
                <button
                  key={origin}
                  onClick={() => {
                    setOriginFilter(origin);
                    setShowOriginFilter(false);
                  }}
                  className="w-full px-2.5 py-1.5 text-left text-xs text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-1.5"
                >
                  {getOriginIcon(origin)}
                  {getOriginLabel(origin)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Upload Area */}
      <div className="p-3 border-b border-zinc-800">
        <div
          className={`relative border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
            isDragOver
              ? "border-green-500 bg-green-500/10"
              : "border-zinc-700 hover:border-zinc-600"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/*,audio/*"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={hasActiveUploads}
          />
          <div className="flex flex-col items-center gap-1.5">
            {hasActiveUploads ? (
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            ) : (
              <Upload className="w-5 h-5 text-zinc-400" />
            )}
            <p className="text-xs text-zinc-400">
              {hasActiveUploads
                ? "Uploading..."
                : "Drop files here or click to upload"}
            </p>
            <p className="text-[10px] text-zinc-500">
              Supports video and audio files
            </p>
          </div>
        </div>

        {/* Upload Progress */}
        {hasActiveUploads && (
          <div className="mt-2 space-y-1">
            {Object.entries(uploadProgress).map(([fileId, progress]) => (
              <div key={fileId} className="bg-zinc-800 rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-300">
                    {progress.status === "uploading" && "Uploading..."}
                    {progress.status === "processing" && "Processing..."}
                    {progress.status === "complete" && "Complete!"}
                    {progress.status === "error" && "Upload failed"}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {progress.progress}%
                  </span>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-1">
                  <div
                    className={`h-1 rounded-full transition-all duration-300 ${
                      progress.status === "error"
                        ? "bg-red-500"
                        : progress.status === "complete"
                        ? "bg-green-500"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Asset List - Single Column Tiles */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {filteredAssets.map((asset) => (
            <div
              key={asset._id}
              className={`relative bg-zinc-900 rounded-lg overflow-hidden cursor-pointer group hover:bg-zinc-800 transition-all duration-200`}
            >
              <div className="flex items-center p-2.5 gap-2.5">
                {/* Thumbnail/Icon */}
                <div className="flex-shrink-0 w-12 h-12 bg-zinc-800 rounded-md flex items-center justify-center relative overflow-hidden">
                  {asset.type === AssetType.VIDEO && asset.thumbnail ? (
                    <img
                      src={asset.thumbnail}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-zinc-500">
                      {asset.type === AssetType.VIDEO ? (
                        <Play className="w-4 h-4" />
                      ) : (
                        <Music className="w-4 h-4" />
                      )}
                    </div>
                  )}
                  {/* Duration overlay */}
                  {asset.duration && (
                    <div className="absolute bottom-0 right-0 bg-black bg-opacity-80 text-white text-[9px] px-1 py-0.5 leading-none">
                      {formatDuration(asset.duration)}
                    </div>
                  )}
                </div>
                {/* Asset Info */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-medium text-white truncate pr-1 leading-tight">
                      {asset.name}
                    </h3>
                    <div className="text-zinc-400 flex-shrink-0 ml-1">
                      {getOriginIcon(asset.origin)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                    <span className="uppercase font-medium tracking-wide">
                      {asset.type}
                    </span>
                    <span className="text-zinc-500">
                      {formatFileSize(asset.bytes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                    <div className="text-[10px] text-zinc-500 truncate">
                      {getOriginLabel(asset.origin)}
                    </div>
                    {/* Timeline Status / Add Button */}
                    <div className="flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToTimeline(asset);
                        }}
                        className="w-6 h-6 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filteredAssets.length === 0 && (
          <div className="text-center text-zinc-500 mt-6">
            <div className="text-2xl mb-2">📁</div>
            <p className="text-xs">
              No {filter === "all" ? "" : filter} assets found
            </p>
            {originFilter !== "all" && (
              <p className="text-[10px] mt-1">
                for {getOriginLabel(originFilter as AssetOrigin)}
              </p>
            )}
          </div>
        )}
      </div>
      {/* Footer Stats */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950">
        <div className="text-[10px] text-zinc-400 space-y-1">
          <div className="flex justify-between">
            <span>Total Assets:</span>
            <span className="text-white">{assets.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Filtered:</span>
            <span className="text-white">{filteredAssets.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetStashSidebar;

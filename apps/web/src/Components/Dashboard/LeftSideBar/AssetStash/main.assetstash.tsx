import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  FileText,
  Layers,
  Upload,
  Filter,
  Loader2
} from "lucide-react";
import type { Asset, ITrack, Project } from "@/State/Types";
import { AssetOrigin, AssetType } from "@/State/Types";
import api from "@/api";
import { toast } from "sonner";
import BeautifulLoader from "@/Components/LoadingScreens/Templatestore.loader.tsx";

import {
  useRefreshAssetStash,
  useRefreshTimeline,
  useRefreshTracks,
} from "../../RefreshContextProvider";

import AssetCardComponent from "./Card.assetstash";

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
  const [loadingStates, setLoadingStates] = useState<{
    [assetId: string]: {
      timeline: boolean;
      backpack: boolean;
    };
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to refresh from GenerateChat
  const { refreshKey: refreshFromGenerateChat } = useRefreshAssetStash();

  // Get triggers to refresh Timeline and Tracks
  const { triggerRefresh: triggerTimelineRefresh } = useRefreshTimeline();
  const { triggerRefresh: triggerTracksRefresh } = useRefreshTracks();

  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
    // Set drag image to be a copy (transparent original)
    e.dataTransfer.setData("application/json", JSON.stringify(asset));
    e.dataTransfer.effectAllowed = "copy";

    // Create a drag image that's a copy of the card
    const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
    dragImage.style.opacity = "0.7";
    dragImage.style.transform = "rotate(5deg)";
    dragImage.style.width = `${e.currentTarget.clientWidth}px`;
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 20, 20);

    // Remove the temporary element after drag starts
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    console.log(`drag ended ${e}`);
  };

  // Helper function to update loading state for specific asset and action
  const setAssetLoadingState = (
    assetId: string,
    action: "timeline" | "backpack",
    isLoading: boolean
  ) => {
    setLoadingStates((prev) => ({
      ...prev,
      [assetId]: {
        ...prev[assetId],
        [action]: isLoading,
      },
    }));
  };

  async function fetchAssets() {
    try {
      setIsLoading(true);

      const assetResponse = await api.get<{ success: boolean; data: Asset[] }>(
        `/asset/project/${currentProject?._id}`
      );

      if (assetResponse.status === 200 || assetResponse.status === 201) {
        setAssets(assetResponse.data.data);
      } else {
        throw new Error(
          "Failed to fetch project"
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
  }, [refreshFromGenerateChat]);

  const formatDuration = (seconds: any) => {
    if (!seconds && seconds !== 0) return "0:00.00";

    const totalSeconds = Number(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    // Format seconds to 2 decimal places, ensuring we always have 2 digits before decimal
    const formattedSeconds = remainingSeconds.toFixed(2).padStart(5, "0");

    return `${minutes}:${formattedSeconds}`;
  };

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)}MB`;
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
      // Set loading state for this specific asset
      setAssetLoadingState(asset._id, "timeline", true);

      // Determine asset type and find matching track
      let assetType: string;
      let trackId: string | null = null;

      if (asset.type === "video") {
        assetType = "video";
      } else if (asset.type === "audio") {
        assetType = "audio";
      } else if (asset.type === "image") {
        // Images typically go to video track
        assetType = "video";
      } else {
        toast.error("Unsupported asset type");
        setAssetLoadingState(asset._id, "timeline", false);
        return;
      }

      // Find the track that matches the asset type
      const matchingTrack = currentProject?.timeline.tracks.find(
        (track: ITrack) => track.type === assetType
      );

      if (!matchingTrack) {
        toast.error(`No ${assetType} track found`);
        setAssetLoadingState(asset._id, "timeline", false);
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
        fadeOut: 0,
      };

      // Make API request
      const response = await api.post<{ success: boolean; message?: string }>(`/track/${trackId}/asset`, requestBody);

      // Check if response indicates success
      if (response.data.success) {
        triggerTimelineRefresh();
        triggerTracksRefresh();
        toast.success("Successfully Added to timeline");
      } else {
        // Display error message from response
        const errorMessage =
          response.data.message || "Failed to add asset to timeline";
        toast.error(errorMessage);
      }
    } catch (error: any) {
      // Handle network errors or other exceptions
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred";
      toast.error(errorMessage);
    } finally {
      // Clear loading state for this specific asset
      setAssetLoadingState(asset._id, "timeline", false);
    }
  };

  const handleAddToBackpack = async (asset: Asset) => {
    try {
      // Set loading state for this specific asset
      setAssetLoadingState(asset._id, "backpack", true);

      const response = await api.post<{ success: boolean; message?: string }>("/backpack/items", {
        itemType: "Asset",
        itemId: asset._id,
        source: "project",
        sourceId: asset.projectId,
        favourite: false,
        tags: [],
        notes: "",
      });

      if (response.data.success === true) {
        asset.isAddedToBackpack = true;
        toast.success("Successfully added template to backpack");
      } else {
        throw Error("Error came in saving template item to backpack");
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Error saving Asset to backpack"
      );
    } finally {
      // Clear loading state for this specific asset
      setAssetLoadingState(asset._id, "backpack", false);
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
      const signatureResponse = await api.post<any>("/asset/upload-signature", {
        projectId: currentProject?._id, // You might want to make this dynamic
        resourceType,
      });

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
      const metadataResponse = await api.post(
        "/asset/save-metadata",
        metadataPayload
      );

      // Add the new asset to the local state
      const newAsset: Asset = {
        _id: (metadataResponse.data as any).asset._id,
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
        metadata: (metadataResponse.data as any).asset.metadata,
        projectId: "project1",
        createdAt: (metadataResponse.data as any).asset.createdAt,
        updatedAt: (metadataResponse.data as any).asset.updatedAt,
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

  if (isLoading) return <BeautifulLoader />;

  return (
    <div className="bg-black border-r border-zinc-800 h-screen flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800">
        {/* <h2 className="text-base font-semibold text-white mb-2">Asset Stash</h2> */}
        {/* Filter Tabs */}
        <div className="flex bg-zinc-800 rounded-lg p-1 mb-2">
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
            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 transition-colors"
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
      {/* Asset List - Updated with drag handlers */}
      <div className="flex-1 overflow-y-auto p-3 pb-12">
        <AssetCardComponent
          loadingStates={loadingStates}
          getOriginLabel={getOriginLabel}
          handleDragEnd={handleDragEnd}
          handleAddToTimeline={handleAddToTimeline}
          handleAddToBackPack={handleAddToBackpack}
          handleDragStart={handleDragStart}
          formatDuration={formatDuration}
          formatFileSize={formatFileSize}
          filteredAssets={filteredAssets}
        />
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

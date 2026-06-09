import { useRef, useState } from "react";
import { maximumPhotoCount } from "../features/photos/fileValidation";

export function PhotoDropzone({
    disabled,
    remainingSlots,
    onFilesSelected
}: {
    disabled: boolean;
    remainingSlots: number;
    onFilesSelected: (files: FileList | readonly File[]) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const openFilePicker = () => {
        if (!disabled) {
            inputRef.current?.click();
        }
    };

    return (
        <div
            className={`upload-zone ${isDragging ? "is-dragging" : ""}`}
            role="button"
            tabIndex={0}
            onClick={openFilePicker}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openFilePicker();
                }
            }}
            onDragEnter={(event) => {
                event.preventDefault();
                if (!disabled) {
                    setIsDragging(true);
                }
            }}
            onDragOver={(event) => {
                event.preventDefault();
                if (!disabled) {
                    event.dataTransfer.dropEffect = "copy";
                }
            }}
            onDragLeave={(event) => {
                if (event.currentTarget === event.target) {
                    setIsDragging(false);
                }
            }}
            onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                if (!disabled) {
                    onFilesSelected(event.dataTransfer.files);
                }
            }}
        >
            <input
                ref={inputRef}
                className="file-input"
                type="file"
                multiple
                accept="image/*"
                disabled={disabled}
                onChange={(event) => {
                    if (event.currentTarget.files !== null) {
                        onFilesSelected(event.currentTarget.files);
                    }

                    event.currentTarget.value = "";
                }}
            />
            <span className="upload-eyebrow">Local photos</span>
            <strong>Drop images here or choose files</strong>
            <span>
                Up to {remainingSlots} more photos, {maximumPhotoCount} total.
            </span>
        </div>
    );
}

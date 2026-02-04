package handlers

import (
	"fmt"
	"os"
	"path/filepath"
)

func CleanupUploadedVideos(uploadPath string) {
	if uploadPath == "" {
		return
	}

	if _, err := os.Stat(uploadPath); os.IsNotExist(err) {
		return
	}

	err := filepath.Walk(uploadPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			if err := os.Remove(path); err != nil {
				fmt.Printf("Failed to remove file %s: %v\n", path, err)
			} else {
				fmt.Printf("Removed file: %s\n", path)
			}
		}
		return nil
	})

	if err != nil {
		fmt.Printf("Error walking the path %s: %v\n", uploadPath, err)
	}
}

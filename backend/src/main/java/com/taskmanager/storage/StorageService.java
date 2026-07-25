package com.taskmanager.storage;

import org.springframework.web.multipart.MultipartFile;

/**
 * Abstraction over "where uploaded files live". {@link LocalStorageService} is
 * the default (dev-friendly, no external account needed); swap in an
 * S3-backed implementation for production by providing another bean.
 */
public interface StorageService {

    /**
     * Persists the file under the given subfolder (e.g. "avatars") and
     * returns a publicly reachable URL for retrieving it.
     */
    String store(MultipartFile file, String subfolder);

    /** Deletes a previously stored file, given the URL returned by {@link #store}. Safe to call on a missing file. */
    void delete(String publicUrl);
}

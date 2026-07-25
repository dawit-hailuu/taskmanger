package com.taskmanager.tag.dto;

import com.taskmanager.tag.Tag;

public record TagResponse(
        Long id,
        Long workspaceId,
        String name,
        String color
) {
    public static TagResponse from(Tag tag) {
        return new TagResponse(tag.getId(), tag.getWorkspace().getId(), tag.getName(), tag.getColor());
    }
}

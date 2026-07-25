package com.taskmanager.tag;

import com.taskmanager.tag.dto.CreateTagRequest;
import com.taskmanager.tag.dto.TagResponse;
import com.taskmanager.user.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@Tag(name = "Tags", description = "Workspace-scoped labels attachable to tasks")
public class TagController {

    private final TagService tagService;

    public TagController(TagService tagService) {
        this.tagService = tagService;
    }

    @Operation(summary = "Create a tag in a workspace")
    @PostMapping("/api/workspaces/{workspaceId}/tags")
    public ResponseEntity<TagResponse> create(@AuthenticationPrincipal User user,
                                              @PathVariable Long workspaceId,
                                              @Valid @RequestBody CreateTagRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(tagService.create(user, workspaceId, request));
    }

    @Operation(summary = "List a workspace's tags")
    @GetMapping("/api/workspaces/{workspaceId}/tags")
    public ResponseEntity<List<TagResponse>> list(@AuthenticationPrincipal User user,
                                                  @PathVariable Long workspaceId) {
        return ResponseEntity.ok(tagService.listForWorkspace(user, workspaceId));
    }

    @Operation(summary = "Delete a tag (creator, or workspace ADMIN/OWNER)")
    @DeleteMapping("/api/tags/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        tagService.delete(user, id);
        return ResponseEntity.noContent().build();
    }
}

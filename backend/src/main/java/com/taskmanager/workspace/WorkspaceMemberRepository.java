package com.taskmanager.workspace;

import com.taskmanager.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorkspaceMemberRepository extends JpaRepository<WorkspaceMember, Long> {

    Optional<WorkspaceMember> findByWorkspaceAndUser(Workspace workspace, User user);

    List<WorkspaceMember> findByWorkspace(Workspace workspace);

    List<WorkspaceMember> findByUser(User user);

    long countByWorkspaceAndRole(Workspace workspace, WorkspaceRole role);

    long countByWorkspace(Workspace workspace);
}

package com.taskmanager.project;

import com.taskmanager.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectMemberRepository extends JpaRepository<ProjectMember, Long> {

    Optional<ProjectMember> findByProjectAndUser(Project project, User user);

    List<ProjectMember> findByProject(Project project);

    long countByProjectAndRole(Project project, ProjectRole role);

    long countByProject(Project project);
}

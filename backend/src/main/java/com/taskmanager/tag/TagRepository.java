package com.taskmanager.tag;

import com.taskmanager.workspace.Workspace;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TagRepository extends JpaRepository<Tag, Long> {

    List<Tag> findByWorkspaceOrderByNameAsc(Workspace workspace);

    boolean existsByWorkspaceAndNameIgnoreCase(Workspace workspace, String name);
}

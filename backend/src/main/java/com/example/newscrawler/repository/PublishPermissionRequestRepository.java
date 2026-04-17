package com.example.newscrawler.repository;

import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.NewsEvent;
import com.example.newscrawler.entity.PublishPermissionRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PublishPermissionRequestRepository extends JpaRepository<PublishPermissionRequest, Long> {
    List<PublishPermissionRequest> findByEvent(NewsEvent event);
    List<PublishPermissionRequest> findByEditor(EditorUser editor);
    Optional<PublishPermissionRequest> findByEventAndEditor(NewsEvent event, EditorUser editor);
    boolean existsByEventAndEditorAndStatus(NewsEvent event, EditorUser editor, String status);
}

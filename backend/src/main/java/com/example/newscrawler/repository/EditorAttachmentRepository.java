package com.example.newscrawler.repository;

import com.example.newscrawler.entity.EditorAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EditorAttachmentRepository extends JpaRepository<EditorAttachment, Long> {
    List<EditorAttachment> findByEditorUserId(Long editorUserId);
}

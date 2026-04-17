package com.example.newscrawler.repository;

import com.example.newscrawler.entity.EditorRequestAttachment;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EditorRequestAttachmentRepository extends JpaRepository<EditorRequestAttachment, Long> {
    List<EditorRequestAttachment> findByEditorRequestId(Long editorRequestId);
}

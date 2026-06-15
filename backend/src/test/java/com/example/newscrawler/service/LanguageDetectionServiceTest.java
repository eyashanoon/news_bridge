package com.example.newscrawler.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class LanguageDetectionServiceTest {

    private LanguageDetectionService service;

    @BeforeEach
    void setUp() {
        service = new LanguageDetectionService();
        service.initDetector();
    }

    @Test
    void detectsSpanishDespiteEnglishMetadata() {
        String text = """
                El gobierno anunció nuevas medidas económicas para combatir la inflación.
                Los expertos dicen que la decisión fue tomada después de varias reuniones
                con representantes del sector privado y organismos internacionales.
                """;
        String detected = service.detectLanguage("en", "Medidas económicas", text);
        assertEquals("es", detected);
    }

    @Test
    void detectsFrenchDespiteEnglishMetadata() {
        String text = """
                Le gouvernement a annoncé de nouvelles mesures économiques pour lutter contre l'inflation.
                Les experts affirment que la décision a été prise après plusieurs réunions importantes.
                """;
        String detected = service.detectLanguage("en", "Mesures économiques", text);
        assertEquals("fr", detected);
    }

    @Test
    void doesNotDefaultToEnglishWhenUncertain() {
        String detected = service.detectLanguage("en", "ABC", "123");
        assertEquals("", detected);
    }

    @Test
    void detectsGermanFromArticleParagraphs() {
        String article = """
                Die Regierung kündigte neue wirtschaftliche Maßnahmen zur Bekämpfung der Inflation an.
                Experten sagen, dass die Entscheidung nach mehreren Sitzungen mit Wirtschaftsvertretern getroffen wurde.
                """;
        String detected = service.detectLanguage("en", "Wirtschaft", "", article);
        assertEquals("de", detected);
    }
}

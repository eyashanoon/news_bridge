package com.example.newscrawler.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "channel_preference_profiles")
public class ChannelPreferenceProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "channel_id", nullable = false, unique = true)
    private TelegramChannel channel;

    @Column(columnDefinition = "TEXT")
    private String adminDescription;

    /** JSON array e.g. ["News","Local","Palestine","Ramallah"] */
    @Column(name = "category_tree_path", columnDefinition = "TEXT")
    private String categoryTreePath;

    /** JSON map tag→weight from questionnaire (highest-weight signal) */
    @Column(name = "questionnaire_intent_vector", columnDefinition = "TEXT")
    private String questionnaireIntentVector;

    /** JSON map tag→weight from admin description tags */
    @Column(name = "description_tag_vector", columnDefinition = "TEXT")
    private String descriptionTagVector;

    /** JSON map tag→weight from recent posts */
    @Column(name = "post_tag_vector", columnDefinition = "TEXT")
    private String postTagVector;

    /** JSON map tag→weight — merged from all sources */
    @Column(name = "final_tag_vector", columnDefinition = "TEXT")
    private String finalTagVector;

    /** JSON float array — description embedding (768-dim or tag-space) */
    @Column(name = "description_embedding", columnDefinition = "TEXT")
    private String descriptionEmbedding;

    /** JSON float array — fused channel identity vector */
    @Column(name = "combined_embedding", columnDefinition = "TEXT")
    private String combinedEmbedding;

    /** JSON: postingFrequency, avgViews, avgEngagement, lastActivityAt */
    @Column(name = "behavioral_signals", columnDefinition = "TEXT")
    private String behavioralSignals;

    @Column(name = "onboarding_completed", nullable = false)
    private boolean onboardingCompleted = false;

    /** Raw questionnaire answers kept for audit only; scoring uses intent vector */
    @Column(name = "onboarding_answers", columnDefinition = "TEXT")
    private String onboardingAnswers;

    @Column(length = 32)
    private String scope;

    @Column(length = 32)
    private String purpose;

    @Column(length = 64)
    private String country;

    @Column(length = 64)
    private String category;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public TelegramChannel getChannel() { return channel; }
    public void setChannel(TelegramChannel channel) { this.channel = channel; }

    public String getAdminDescription() { return adminDescription; }
    public void setAdminDescription(String adminDescription) { this.adminDescription = adminDescription; }

    public String getCategoryTreePath() { return categoryTreePath; }
    public void setCategoryTreePath(String categoryTreePath) { this.categoryTreePath = categoryTreePath; }

    public String getQuestionnaireIntentVector() { return questionnaireIntentVector; }
    public void setQuestionnaireIntentVector(String v) { this.questionnaireIntentVector = v; }

    public String getDescriptionTagVector() { return descriptionTagVector; }
    public void setDescriptionTagVector(String v) { this.descriptionTagVector = v; }

    public String getPostTagVector() { return postTagVector; }
    public void setPostTagVector(String v) { this.postTagVector = v; }

    public String getFinalTagVector() { return finalTagVector; }
    public void setFinalTagVector(String v) { this.finalTagVector = v; }

    public String getDescriptionEmbedding() { return descriptionEmbedding; }
    public void setDescriptionEmbedding(String v) { this.descriptionEmbedding = v; }

    public String getCombinedEmbedding() { return combinedEmbedding; }
    public void setCombinedEmbedding(String v) { this.combinedEmbedding = v; }

    public String getBehavioralSignals() { return behavioralSignals; }
    public void setBehavioralSignals(String v) { this.behavioralSignals = v; }

    public boolean isOnboardingCompleted() { return onboardingCompleted; }
    public void setOnboardingCompleted(boolean v) { this.onboardingCompleted = v; }

    public String getOnboardingAnswers() { return onboardingAnswers; }
    public void setOnboardingAnswers(String v) { this.onboardingAnswers = v; }

    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }

    public String getPurpose() { return purpose; }
    public void setPurpose(String purpose) { this.purpose = purpose; }

    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}

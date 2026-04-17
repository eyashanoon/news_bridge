package com.example.newscrawler.entity;

public enum UserRole {
    // Standard User Actions
    READ_ARTICLE,
    MANAGE_OWN_PROFILE,
    REACT_POST,
    LEAVE_COMMENT,

    // Conditional User Actions
    REPORT_POST,
    CREATE_EDITOR_REQUEST,

    // Editor Actions
    PUBLISH_LIVE_NEWS,
    EDIT_LIVE_NEWS,
    DELETE_LIVE_NEWS,

    // System/Crawler Actions
    WRITE_SYSTEM_ARTICLE,
    READ_SYSTEM_METADATA,

    // Admin Actions
    MANAGE_USERS,
    VIEW_EDITOR_REQUESTS,
    APPROVE_EDITOR_REQUESTS,
    VIEW_EDITOR_INFO,
    SUSPEND_EDITOR,
    UPDATE_ANY_ARTICLE,
    DELETE_ANY_ARTICLE,
    CREATE_ADMIN,
    VIEW_CRAWLER_LOGS,
    CONTROL_CRAWLER,
    MANAGE_EVENTS,
    APPROVE_PUBLISH_REQUESTS,
    MANAGE_TELEGRAM_CHANNELS,
    VIEW_TELEGRAM_POSTS,
    CONTROL_TELEGRAM_CRAWLER,
    WRITE_TELEGRAM_POSTS,

    // Deprecated Legacy Roles (Kept strictly to prevent database deserialization crashes on existing rows)
    @Deprecated OWNER,
    @Deprecated CRAWLER,
    @Deprecated PRIMITIVE,
    @Deprecated REGISTERED,
    @Deprecated EDITOR,
    @Deprecated ADMIN
}

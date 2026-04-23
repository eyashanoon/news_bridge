package com.example.newscrawler.dto;

public record CommentVoteRequest(
    Integer voteType // 1 for upvote, -1 for downvote, 0 to remove vote
) {}

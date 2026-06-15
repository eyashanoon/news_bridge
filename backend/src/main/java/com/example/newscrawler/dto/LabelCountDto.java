package com.example.newscrawler.dto;

public class LabelCountDto {
    public String label;
    public long count;
    public double value;

    public LabelCountDto() {}

    public LabelCountDto(String label, long count) {
        this.label = label;
        this.count = count;
    }

    public LabelCountDto(String label, double value) {
        this.label = label;
        this.value = value;
    }
}

package com.taskmanager.profile.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(

        @NotBlank(message = "Name is required")
        @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
        String name,

        @Size(max = 1000, message = "Bio must not exceed 1000 characters")
        String bio,

        @Pattern(regexp = "^$|^[+]?[0-9 ()-]{7,30}$", message = "Enter a valid phone number")
        String phone,

        @NotBlank(message = "Timezone is required")
        String timezone
) {
}

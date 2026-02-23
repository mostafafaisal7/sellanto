from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class OnboardingProgress(models.Model):
    STEP_CHOICES = [
        (1, 'Create Workspace'),
        (2, 'Brand Wizard'),
        (3, 'Connect Platforms'),
        (4, 'AI & Automation Setup'),
        (5, 'Generate Brand DNA'),
        (6, 'Launch Plan Setup'),
        (7, 'Onboarding Complete'),
    ]

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='onboarding_progress'
    )
    current_step = models.IntegerField(default=1)
    completed_steps = models.JSONField(default=list)
    is_completed = models.BooleanField(default=False)
    is_skipped = models.BooleanField(default=False)
    skipped_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'onboarding_progress'
        verbose_name = 'Onboarding Progress'
        verbose_name_plural = 'Onboarding Progress'

    def __str__(self):
        if self.is_completed:
            return f"{self.user.username} - Completed"
        if self.is_skipped:
            return f"{self.user.username} - Skipped"
        return f"{self.user.username} - Step {self.current_step}"

    def mark_step_completed(self, step_number):
        if step_number not in self.completed_steps:
            self.completed_steps = self.completed_steps + [step_number]
        if step_number < 7:
            self.current_step = step_number + 1
        else:
            self.is_completed = True
            self.completed_at = timezone.now()
        self.save()

    def skip_onboarding(self):
        self.is_skipped = True
        self.skipped_at = timezone.now()
        self.save()

    @property
    def needs_onboarding(self):
        return not self.is_completed and not self.is_skipped

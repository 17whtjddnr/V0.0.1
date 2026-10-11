export function experienceRequired(level = 1) {
    return 100 * 2 ** (Math.max(1, Math.floor(Number(level) || 1)) - 1);
}

export function initializeExperience(character, levelKey = 'level') {
    character.experience = Math.max(0, Number(character.experience) || 0);
    character.experienceToNextLevel = Math.max(1, Number(character.experienceToNextLevel) || experienceRequired(character[levelKey]));
}

export function advanceExperienceAtWeekStart(character, levelKey = 'level') {
    initializeExperience(character, levelKey);
    if (character.experience < character.experienceToNextLevel) return null;
    const previousLevel = Math.max(1, Number(character[levelKey]) || 1);
    character[levelKey] = previousLevel + 1;
    character.experience = 0;
    character.experienceToNextLevel *= 2;
    return { previousLevel, level: character[levelKey], maximumExperience: character.experienceToNextLevel };
}

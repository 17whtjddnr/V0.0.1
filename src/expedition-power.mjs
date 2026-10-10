import { recommendedExpeditionPower } from './expedition-forecast.mjs';
export { recommendedExpeditionPower } from './expedition-forecast.mjs';
export function recommendedMonsterPower(monsters, characters = []) {
    return recommendedExpeditionPower(monsters, characters).power;
}

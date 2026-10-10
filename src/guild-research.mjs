const researchNodes = [
    { id: 'wages', title: '길드원 주급 감소', icon: 'coin_pouch_icon.svg', cost: 5000, description: '길드원 주급이 5% 감소합니다.' },
    { id: 'rental', title: '아지트 임대 - 2단계', icon: 'castle_icon.svg', cost: 10000, description: '더 좋은 아지트 건물을 소유하게 됩니다. 길드원 총원이 15명으로 증가하며, 파견 임무를 최대 3개까지 보낼 수 있습니다.' },
    { id: 'encounters', title: '광장 조우 인원 증가', icon: 'party_icon.svg', cost: 3000, description: '광장 조우 인원이 4명으로 증가합니다. 조우하는 캐릭터의 직업은 무작위입니다.' },
];

export function guildResearchMarkup(gold = 0, founding = false) {
    const availableGold = Math.max(0, Number(gold) || 0);
    const nodes = founding ? [{ id: 'rental', title: '1단계 아지트 임대', icon: 'castle_icon.svg', cost: 5000, description: '길드의 첫 보금자리를 마련합니다. 최대 4명의 길드원을 맞이할 수 있으며, 엘리아가 첫 길드원으로 합류합니다.' }] : researchNodes;
    return `<section class="guild-research${founding ? ' is-founding' : ''}" aria-label="길드 연구"><div class="guild-research-connections" aria-hidden="true"></div><div class="guild-research-nodes">${nodes.map((node) => {
        const insufficient = availableGold < node.cost;
        return `<div class="guild-research-node${node.id === 'rental' ? ' is-central' : ''}${insufficient ? ' is-unaffordable' : ''}" ${founding ? 'role="button" data-action="tutorial-rent"' : 'role="group"'} aria-disabled="${insufficient}" tabindex="0" aria-describedby="research-tooltip-${node.id}"><div class="guild-research-icon"><img src="/assets/icons/${node.icon}" alt="" aria-hidden="true"></div><strong>${node.title}</strong><span class="guild-research-cost"><img src="/assets/icons/coin_pouch_icon.svg" alt="" aria-hidden="true">${node.cost}G</span><div class="guild-research-tooltip" role="tooltip" id="research-tooltip-${node.id}"><strong>${node.title}</strong><p>${node.description}</p>${insufficient ? `<p class="guild-research-shortage">소지금 부족 · ${(node.cost - availableGold).toLocaleString('ko-KR')}G 필요</p>` : ''}</div></div>`;
    }).join('')}</div></section>`;
}

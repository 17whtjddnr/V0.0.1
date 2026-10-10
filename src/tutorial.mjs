export const TUTORIAL_COMPANION_ID = "CHAR-208";
export const tutorialPrologue = [
  {
    "background": "tutorial-land.webp",
    "text": "의도적으로 잊혀진 과거."
  },
  {
    "background": "tutorial-storm-sea.webp",
    "text": "세상의 끝이라 믿었던 바다.\n그 너머에도 세상은 있었다."
  },
  {
    "background": "tutorial-audience-chamber.webp",
    "text": "3년 전."
  },
  {
    "background": "tutorial-audience-chamber.webp",
    "text": "백성을 속여 온 왕이 달아났다.\n그리고, 감춰 두었던 모든 것이 드러났다."
  },
  {
    "background": "tutorial-war-room-3.webp",
    "text": "그 뒤로 3년. 새 왕실은 신대륙을 향해 눈을 돌렸다.\n한정된 제국군 대신, 자유로운 길드를 지원하기로 했다."
  },
  {
    "background": "tutorial-war-room-3.webp",
    "text": "길드는 본래의 자유로움에 더해 부와 명성까지 얻었다.\n나는 완전히 매료되었다."
  },
  {
    "background": "tutorial-war-room-3.webp",
    "text": "격동하는 시대와 발맞추어, 위대한 길드 마스터로 성장하는 이야기.\n바로, 나의 이야기다."
  }
];
export const tutorialDialogues = [
  {
    "id": "tutorial.meeting",
    "presentation": "oneOnOne",
    "characterId": TUTORIAL_COMPANION_ID,
    "start": "line0",
    "nodes": {
      "line0": {
        "speaker": "",
        "text": "의뢰 게시판에 왕실에서 발행한 신대륙 토벌 공고문이 가득하다.",
        "presentation": "monologue",
        "next": "line1"
      },
      "line1": {
        "speaker": "{{playerName}}",
        "text": "시작은 온바람 평야겠지? 다들 지나간 길이니까… 혼자라도 할 만할 거야.",
        "presentation": "monologue",
        "next": "line2"
      },
      "line2": {
        "speaker": "{{characterName}}",
        "text": "온바람 평야로 가시나요? 저도 그쪽으로 가려던 참이에요.",
        "next": "line3"
      },
      "line3": {
        "speaker": "{{playerName}}",
        "text": "으앗! 아, 네. 방금 말은… 그냥 혼잣말이었는데요.",
        "next": "line4"
      },
      "line4": {
        "speaker": "{{characterName}}",
        "text": "죄송해요. 혼잣말에 대답해 버렸네요. 바람이 잘 전해 줘서요.",
        "next": "line5"
      },
      "line5": {
        "speaker": "{{playerName}}",
        "text": "괜찮아요! 그렇지만 혼자도 가능하다는 건, 아직 확인 전이라…",
        "next": "line6"
      },
      "line6": {
        "speaker": "{{characterName}}",
        "text": "그럼 둘이 확인해 볼까요? 길은 제가 조금 알아요.",
        "next": "line7"
      },
      "line7": {
        "speaker": "{{playerName}}",
        "text": "정말요? 좋아요. 저는 {{playerName}}예요.",
        "next": "line8"
      },
      "line8": {
        "speaker": "{{characterName}}",
        "text": "{{characterName}}이에요.",
        "next": "line9"
      },
      "line9": {
        "speaker": "{{characterName}}",
        "text": "두 분만 더 모셔 볼까요? 혼자 해낼 용기도 좋지만, 광장에 강한 분들이 많은 것 같아요",
        "end": true
      }
    }
  },
  {
    "id": "tutorial.founding",
    "presentation": "oneOnOne",
    "characterId": TUTORIAL_COMPANION_ID,
    "start": "line0",
    "nodes": {
      "line0": {
        "speaker": "{{characterName}}",
        "text": "아까 그 마지막 일격, 멋졌어요. 벌레도 깜짝 놀랐을 거예요.",
        "next": "line1"
      },
      "line1": {
        "speaker": "{{playerName}}",
        "text": "그 벌레… 원래 좀 약했던 것 같기도 한데요.",
        "next": "line2"
      },
      "line2": {
        "speaker": "{{characterName}}",
        "text": "약한 적도 방심하지 않으셨잖아요. 좋은 마스터의 시작이에요.",
        "next": "line3"
      },
      "line3": {
        "speaker": "{{playerName}}",
        "text": "마스터라… 사실 위대한 길드 마스터가 되는 게 제 꿈이에요.",
        "next": "line4"
      },
      "line4": {
        "speaker": "{{characterName}}",
        "text": "그럼 저, 첫 길드원이 되어도 될까요?",
        "next": "line5"
      },
      "line5": {
        "speaker": "{{playerName}}",
        "text": "…실은 아직 정식 길드 창설조차 하지 못했어요. 아지트 임대료를 모으던 중이거든요.",
        "next": "line6"
      },
      "line6": {
        "speaker": "{{characterName}}",
        "text": "제가 가진 전부예요. 가장 저렴한 아지트는 임대할 수 있을 거예요. 괜찮다면 임대료로 써 주세요.",
        "next": "line7"
      },
      "line7": {
        "speaker": "{{playerName}}",
        "text": "오천...골드요? 잠깐만요. 그렇게 큰 금액을 받을 수는... (사기꾼인가? 천사인가?)",
        "next": "line8"
      },
      "line8": {
        "speaker": "{{characterName}}",
        "text": "부디 받아주세요. 대신 약속 하나만요.",
        "next": "line9"
      },
      "line9": {
        "speaker": "{{playerName}}",
        "text": "...약속이요?",
        "next": "line10"
      },
      "line10": {
        "speaker": "{{characterName}}",
        "text": "동료들이 돌아올 자리를 만들어 주세요. 크지 않아도, 따뜻한... 그런 길드를 만들어주세요",
        "next": "aside"
      },
      "line11": {
        "speaker": "{{playerName}}",
        "text": "네. 꼭 그렇게 할게요. …첫 길드원부터 너무 든든한데요.",
        "next": "line12"
      },
      "line12": {
        "speaker": "{{characterName}}",
        "text": "그럼 마스터님, 장부부터 열어 볼까요? 꿈에도 집세는 필요하니까요.",
        "end": true
      }
    }
  }
];

tutorialDialogues.find(dialogue => dialogue.id === 'tutorial.founding').nodes.aside = {
    speaker: '{{playerName}}', presentation: 'monologue',
    text: '(웃는 얼굴도 눈부신데, 제안은 더 눈부시네. 침착하자. 일단 고개부터 끄덕이자.)',
    next: 'line11',
};

export const tutorialGuides = {
    'look-first': ['광장을 살펴보고 첫 동료를 만나세요.', 'plaza-look-around'],
    'hire-first': ['용병 제안으로 첫 동료를 모집하세요.', 'plaza-hire'],
    'look-second': ['한 분만 더! 광장을 다시 살펴보세요.', 'plaza-look-around'],
    'hire-second': ['용병 제안으로 마지막 동료를 모집하세요.', 'plaza-hire'],
    depart: ['준비 완료! 온바람 평야 북부로 출발하세요.', 'plaza-depart'],
    battle: ['스킬을 고른 뒤 적을 눌러 공격하세요.', 'skill'],
    'guild-open': ['{{characterName}}과 함께 길드 설립을 준비하세요.', 'guild-open'],
    rent: ['5000골드로 첫 아지트를 임대하세요.', 'tutorial-rent'],
    'guild-exit': ['광장으로 돌아가 길드원을 선발해 보세요.', 'guild-exit'],
    'select-open': ['빈 원정대 슬롯의 길드원 선발을 누르세요.', 'plaza-guild-select-open'],
    'select-companion': ['{{characterName}}을(를) 원정대원으로 선발하세요.', 'plaza-guild-toggle'],
};
export function tutorialActionAllowed(tutorial, action, memberId) {
    const stage = tutorial?.stage;
    if (!stage || stage === 'done') return true;
    if (stage === 'meeting' || stage === 'founding-story') return action === 'plaza-dialogue-advance';
    if (['rent-popup', 'companion-popup', 'final-popup'].includes(stage)) return action === 'tutorial-confirm';
    if (stage === 'battle') return ['skill', 'combat-wait', 'combat-target', 'combat-ally', 'expedition-result-confirm', 'retreat', 'retreat-cancel', 'retreat-confirm'].includes(action);
    if (stage === 'select-companion') return action === 'plaza-guild-toggle' && memberId === TUTORIAL_COMPANION_ID;
    return action === tutorialGuides[stage]?.[1];
}
export function completeTutorialRental(state, companion) {
    if (state.tutorial?.stage !== 'rent' || state.gold < 5000) return false;
    state.gold -= 5000;
    state.tutorial.stage = 'rent-popup';
    state.guildFounded = true;
    state.tutorial.companion = { ...companion, weeklyWage: 0, wageExempt: true, isGuildMember: true };
    return true;
}
export function confirmTutorialMilestone(state) {
    if (state.tutorial?.stage === 'rent-popup') {
        const companion = state.tutorial.companion;
        if (!state.guildMembers.some(member => member.id === companion.id)) state.guildMembers.push(companion);
        state.guildSecretaryId = companion.id;
        state.tutorial.stage = 'companion-popup';
    } else if (state.tutorial?.stage === 'companion-popup') {
        state.view = 'guild';
        state.guildRoom = 'lobby';
        state.guildResearchOpen = false;
        state.tutorial.stage = 'guild-exit';
    } else if (state.tutorial?.stage === 'final-popup') {
        state.plazaGuildSelectionOpen = false;
        state.tutorial.stage = 'done';
    } else return false;
    return true;
}

export function restoreTutorialState(state, savedState) {
    const stage = savedState.tutorial?.stage;
    if (!stage || stage === 'done') return false;
    Object.assign(state, savedState);
    state.lobbyDialog = '';
    if (['rent', 'rent-popup', 'companion-popup'].includes(stage)) {
        state.view = 'guild';
        state.guildRoom = 'strategy';
        state.guildResearchOpen = true;
    } else if (stage === 'guild-exit') {
        state.view = 'guild';
        state.guildRoom = 'lobby';
        state.guildResearchOpen = false;
    } else if (stage === 'battle') {
        state.view = 'expedition';
        if (!state.expeditionResult) {
            state.mode = 'combat';
            state.enemyPhase = false;
            state.actingEnemy = -1;
            state.turn = -1;
            state.turnOrder = [];
            state.turnOrderIndex = 0;
            state.selectedSkill = null;
        }
    } else {
        state.view = 'plaza';
        state.plazaGuildSelectionOpen = ['select-companion', 'final-popup'].includes(stage);
    }
    return true;
}


// Use the stable character ID while keeping saved tutorial portraits and names current.
export function syncTutorialCompanion(state, profile, party = []) {
    if (!profile) return;
    const references = [state.tutorial?.companion, ...(state.guildMembers || []), ...(state.recruits || []), ...party].filter(Boolean);
    for (const member of new Set(references)) {
        if (!member.tutorialCompanion) continue;
        const previousId = member.id;
        if (previousId !== TUTORIAL_COMPANION_ID) {
            Object.assign(member, profile, { stats: { ...profile.stats }, baseStats: { ...profile.stats },
                hp: profile.stats.maxHp, maxHp: profile.stats.maxHp, cooldowns: {}, effects: [] });
            if (state.guildSecretaryId === previousId) state.guildSecretaryId = TUTORIAL_COMPANION_ID;
            for (const dispatch of state.guildDispatches || []) {
                dispatch.memberIds = (dispatch.memberIds || []).map(id => id === previousId ? TUTORIAL_COMPANION_ID : id);
                for (const snapshot of dispatch.memberSnapshots || []) {
                    if (snapshot.id === previousId) Object.assign(snapshot, { id: TUTORIAL_COMPANION_ID, name: profile.name,
                        portraitSrc: profile.portraitSrc, thumbnailSrc: profile.thumbnailSrc });
                }
            }
            state.guildDispatchMemberIds = (state.guildDispatchMemberIds || []).map(id => id === previousId ? TUTORIAL_COMPANION_ID : id);
            if (state.affinityByCharacterId?.[previousId] !== undefined && state.affinityByCharacterId[TUTORIAL_COMPANION_ID] === undefined) {
                state.affinityByCharacterId[TUTORIAL_COMPANION_ID] = state.affinityByCharacterId[previousId];
            }
        }
        Object.assign(member, { id: TUTORIAL_COMPANION_ID, name: profile.name,
            portraitSrc: profile.portraitSrc, thumbnailSrc: profile.thumbnailSrc,
            tutorialCompanion: true, wageExempt: true, weeklyWage: 0 });
    }
}

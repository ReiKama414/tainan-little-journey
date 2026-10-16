import { COLLECTIBLES_DATA, SIDE_QUESTS_DATA, TAINAN_FOOD_CHOICES } from '../data/scenesData';

export class CollectibleSystem {
  data = {
    collectedIds: [],
    tastedFoods: [],
    completedSideQuests: [],
    capturedPhotos: [],
    unlockedOutfits: [],
    selectedBlessingTitle: '',
    selectedBlessingText: '',
    hasWatchedSunset: false,
    gameCompleted: false,
    totalPlayTimeSeconds: 0
  };
  listeners = [];

  constructor() { this.load(); }
  onChange(fn) { this.listeners.push(fn); }
  notify() { this.save(); for (const fn of this.listeners) fn(); }

  load() {
    try {
      const raw = localStorage.getItem('tainan_journey_v2_save');
      if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
    } catch {}
  }

  save() {
    try {
      localStorage.setItem('tainan_journey_v2_save', JSON.stringify(this.data));
    } catch {}
  }

  reset() {
    this.data = {
      collectedIds: [],
      tastedFoods: [],
      completedSideQuests: [],
      capturedPhotos: [],
      unlockedOutfits: [],
      selectedBlessingTitle: '',
      selectedBlessingText: '',
      hasWatchedSunset: false,
      gameCompleted: false,
      totalPlayTimeSeconds: 0
    };
    this.notify();
  }

  addPlayTime(dt) { this.data.totalPlayTimeSeconds += dt; }
  getPlayTimeSeconds() { return Math.round(this.data.totalPlayTimeSeconds); }

  unlock(id) {
    const isNew = !this.data.collectedIds.includes(id);
    if (isNew) this.data.collectedIds.push(id);
    if (id === 'anping_sunset_photo') {
      this.data.hasWatchedSunset = true;
      this.data.gameCompleted = true;
    }
    this.notify();
    return isNew;
  }

  recordFoodTasted(foodId) {
    if (!this.data.tastedFoods.includes(foodId)) this.data.tastedFoods.push(foodId);
    return this.unlock('guohua_food_gold_card');
  }

  recordBlessing(title, text) {
    this.data.selectedBlessingTitle = title;
    this.data.selectedBlessingText = text;
    return this.unlock('confucius_blessing_ema');
  }

  completeSideQuest(questId) {
    const isNew = !this.data.completedSideQuests.includes(questId);
    if (isNew) {
      this.data.completedSideQuests.push(questId);
      if (questId === 'quest_shennong_cat') {
        this.unlock('alley_cat_charm');
        this.data.unlockedOutfits.push('cat_ears');
      } else if (questId === 'quest_chihkan_quiz') {
        this.unlock('martial_dazhangfu_talisman');
      } else if (questId === 'quest_confucius_paperweight') {
        this.unlock('pangong_paperweight');
      } else if (questId === 'quest_anping_lions') {
        this.unlock('anping_sword_lion_plaque');
      }
    }
    this.notify();
    return isNew;
  }

  isSideQuestCompleted(questId) { return this.data.completedSideQuests.includes(questId); }
  isCollected(id) { return this.data.collectedIds.includes(id); }
  getCollectedCount() { return this.data.collectedIds.length; }
  getTotalCount() { return COLLECTIBLES_DATA.length; }
  getTastedFoodCount() { return this.data.tastedFoods.length; }
  getCompletedSideQuestCount() { return this.data.completedSideQuests.length; }
  getCapturedPhotosCount() { return this.data.capturedPhotos.length; }

  addPhoto(photo) {
    const exists = this.data.capturedPhotos.some(p => p.id === photo.id);
    if (!exists) this.data.capturedPhotos.push(photo);
    if (photo.id === 'photo_shennong_1') this.completeSideQuest('quest_shennong_photo');
    else if (photo.id === 'photo_sunset_final') {
      this.completeSideQuest('quest_anping_sunset_spot');
      this.unlock('anping_sunset_photo');
    }
    this.notify();
    return !exists;
  }

  getExplorationPercentage() {
    const totalPoints = COLLECTIBLES_DATA.length + TAINAN_FOOD_CHOICES.length + SIDE_QUESTS_DATA.length + 6;
    const currentPoints = this.getCollectedCount() + this.getTastedFoodCount() + this.getCompletedSideQuestCount() + this.getCapturedPhotosCount();
    return Math.min(100, Math.round((currentPoints / totalPoints) * 100));
  }

  getData() { return this.data; }
  getAllCollectiblesWithState() {
    return COLLECTIBLES_DATA.map(item => ({ ...item, unlocked: this.isCollected(item.id) }));
  }
  getAllSideQuestsWithState() {
    return SIDE_QUESTS_DATA.map(q => ({ ...q, completed: this.isSideQuestCompleted(q.id) }));
  }
  getAllFoodsWithState() {
    return TAINAN_FOOD_CHOICES.map(f => ({ ...f, tasted: this.data.tastedFoods.includes(f.id) }));
  }
  getPhotos() { return this.data.capturedPhotos; }
}

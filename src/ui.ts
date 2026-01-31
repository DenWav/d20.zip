import { DiceBag, RollGroup, RollRecord } from './dice.js';
import { UI } from './constants.js';
import { State } from './state.js';

export class UiManager {
    public state!: State;
    private errorMessageTimeout: number | undefined;

    constructor(private readonly dice: DiceBag) {}

    private static formatBreakdown(record: RollRecord): string {
        if (record.result === null) return 'Rolling...';
        return record.breakdown || '';
    }

    public updateHistoryUI() {
        const historyListEl = document.getElementById('history-list');
        if (historyListEl) {
            historyListEl.innerHTML = this.dice.rollHistory
                .map(
                    (record) =>
                        `
                        <div class="history-item">
                            <div class="history-header">
                                <span>${record.formula}</span>
                                <span class="history-result">${record.result !== null ? record.result : '...'}</span>
                            </div>
                            ${record.result !== null ? `<div class="history-breakdown">${UiManager.formatBreakdown(record)}</div>` : ''}
                            <button class="re-roll-btn" onclick="window.reRollById(${record.id})">Re-roll</button>
                        </div>
                        `
                )
                .join('');
        }

        const latestResultEl = document.getElementById('latest-result');
        if (latestResultEl) {
            if (this.dice.rollHistory.length > 0 && this.dice.rollHistory[0].result !== null) {
                latestResultEl.innerText = this.dice.rollHistory[0].result.toString();
            } else {
                latestResultEl.innerText = '';
            }
        }
    }

    public addToHistory(roll: RollRecord) {
        this.dice.rollHistory.unshift(roll);

        if (this.dice.rollHistory.length > UI.MAX_HISTORY) {
            this.dice.rollHistory.pop();
        }
        this.dice.pruneDiceList();
        this.updateHistoryUI();
        this.state.saveState();
    }

    public showErrorMessage(message: string) {
        const errorEl = document.getElementById('error-message');
        if (errorEl) {
            errorEl.innerText = message;
            errorEl.style.display = 'block';
            if (this.errorMessageTimeout) clearTimeout(this.errorMessageTimeout);
            this.errorMessageTimeout = window.setTimeout(() => {
                errorEl.style.display = 'none';
                this.errorMessageTimeout = undefined;
            }, UI.ERROR_MESSAGE_TIMEOUT);
        }
    }

    public hideErrorMessage() {
        const errorEl = document.getElementById('error-message');
        if (errorEl) {
            errorEl.style.display = 'none';
            if (this.errorMessageTimeout) {
                clearTimeout(this.errorMessageTimeout);
                this.errorMessageTimeout = undefined;
            }
        }
    }
}

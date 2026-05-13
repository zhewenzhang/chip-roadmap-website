/**
 * Roadmap Derived Data Pipeline
 *
 * Builds a verified timeline matrix entirely from signals data.
 * Roadmap is a derived visualization layer — signals are the system of record.
 *
 * Exports:
 *   isRoadmapEligibleSignal(signal)
 *   buildRoadmapMatrixFromSignals(signals)
 *   getRoadmapYears(matrix)
 *   getRoadmapCompanies(matrix)
 */

// Only verified signals with advanced stages and usable timeline fields
const ROADMAP_STATUSES = ['verified'];
const ROADMAP_STAGES = ['pilot', 'ramp', 'volume'];

/**
 * Check if a normalized signal qualifies for the roadmap.
 *
 * Rules:
 *   - status === 'verified'
 *   - stage ∈ { pilot, ramp, volume }
 *   - release_year exists and is a valid number
 *   - release_quarter exists (Q1-Q4)
 *
 * @param {Object} signal — normalized signal
 * @returns {boolean}
 */
export function isRoadmapEligibleSignal(signal) {
    if (!ROADMAP_STATUSES.includes(signal.status)) return false;
    if (!ROADMAP_STAGES.includes(signal.stage)) return false;
    if (!signal.release_year || isNaN(Number(signal.release_year))) return false;
    if (!signal.release_quarter || !/^Q[1-4]$/.test(signal.release_quarter)) return false;
    return true;
}

/**
 * Build a company × year × quarter matrix from eligible signals.
 *
 * Each cell contains a sorted list of signals that land in that slot.
 *
 * Cell sorting (deterministic):
 *   1. higher ABF impact first
 *   2. higher confidence first
 *   3. alphabetic chip name
 *
 * @param {Array} signals — normalized signal array
 * @param {Object} _context — reserved for future use (e.g. company catalog)
 * @returns {Object} matrix keyed by companyId:
 *   {
 *     [companyId]: {
 *       companyName: string,
 *       cells: {
 *         [year]: {
 *           [quarter]: [signal, ...]
 *         }
 *       }
 *     }
 *   }
 */
export function buildRoadmapMatrixFromSignals(signals, _context = {}) {
    const matrix = {};

    const eligible = signals.filter(isRoadmapEligibleSignal);

    for (const signal of eligible) {
        const companyId = signal.company_id;
        const year = Number(signal.release_year);
        const quarter = signal.release_quarter;

        if (!matrix[companyId]) {
            matrix[companyId] = {
                companyName: signal.company_name,
                cells: {},
            };
        }

        if (!matrix[companyId].cells[year]) {
            matrix[companyId].cells[year] = {};
        }

        if (!matrix[companyId].cells[year][quarter]) {
            matrix[companyId].cells[year][quarter] = [];
        }

        matrix[companyId].cells[year][quarter].push(signal);
    }

    // Sort each cell deterministically
    const IMPACT_SORT = { explosive: 4, high: 3, medium: 2, low: 1 };

    for (const companyId of Object.keys(matrix)) {
        for (const year of Object.keys(matrix[companyId].cells)) {
            for (const quarter of Object.keys(matrix[companyId].cells[year])) {
                const cell = matrix[companyId].cells[year][quarter];
                cell.sort((a, b) => {
                    // 1. ABF impact desc
                    const impA = IMPACT_SORT[a.abf_demand_impact] || 0;
                    const impB = IMPACT_SORT[b.abf_demand_impact] || 0;
                    if (impB !== impA) return impB - impA;
                    // 2. confidence desc
                    if (b.confidence_score !== a.confidence_score) return b.confidence_score - a.confidence_score;
                    // 3. chip name alpha
                    return (a.chip_name || '').localeCompare(b.chip_name || '');
                });
            }
        }
    }

    return matrix;
}

/**
 * Extract sorted years from the matrix.
 *
 * @param {Object} matrix
 * @returns {number[]}
 */
export function getRoadmapYears(matrix) {
    const years = new Set();
    for (const company of Object.values(matrix)) {
        for (const year of Object.keys(company.cells)) {
            years.add(Number(year));
        }
    }
    return [...years].sort((a, b) => a - b);
}

/**
 * Extract company IDs present in the matrix.
 *
 * @param {Object} matrix
 * @returns {string[]}
 */
export function getRoadmapCompanies(matrix) {
    return Object.keys(matrix).sort();
}

/**
 * Get a flat list of all roadmap entries for iteration.
 *
 * @param {Object} matrix
 * @returns {Array<{ companyId, companyName, year, quarter, signals }>}
 */
export function getRoadmapEntries(matrix) {
    const entries = [];
    for (const [companyId, company] of Object.entries(matrix)) {
        for (const [yearStr, quarters] of Object.entries(company.cells)) {
            const year = Number(yearStr);
            for (const [quarter, sigs] of Object.entries(quarters)) {
                entries.push({ companyId, companyName: company.companyName, year, quarter, signals: sigs });
            }
        }
    }
    return entries;
}

# Model rules (M1)

Starting values for the dengue simulator. Every value marked "slider" is only where the control starts when the app opens; users can change it, and Reset restores it. Values are carried over from the earlier Python engine (dengue_sim.py) unless noted.

## Decisions made

| Rule | Decision | Basis |
|---|---|---|
| Imported-case surge window | Weeks 30-44, 2019 only, on/off switch | Checked against 2019 weekly cases: cases jump at week 32 and stay high through week 44, and imports must come 1-2 weeks before cases show |
| Cleaning days | Staggered: each household gets a random day within its municipality's interval | Old engine |
| Who cleans | Re-rolled each scheduled day: every household has a compliance chance of cleaning | Old engine |
| Cleaning compliance | Slider, starts at 50% (Q7 marked 26-50%) | Questionnaire Q7 |
| Cleaning strength (immatures removed in a cleaned household) | Slider, starts at 70% | Old engine, assumption |
| Fogging strength (adults killed in a fogged household) | Slider, starts at 50%, labeled "not provided by PHO" | Q6 left blank, placeholder |
| Fogging reach (households covered per round) | Slider, starts at 60% | Old engine, assumption |
| Fogging trigger | 1 reported case in 7 days, slider 1 to 20 | Q5, policy_data.csv |
| Fogging cooldown | 7 days between rounds in a municipality | Q9 |
| Collection interval | 7 days (all municipalities), can be overridden | policy_data.csv |

## People

- 1 simulated person = 10 real people; 5 simulated people per household (18,986 people, 3,797 households)
- Exposed for 5 days, then infectious for 6 days, then recovered
- 2% of recovered people per year return to susceptible (assumption)
- 30% of people are away from home on a given day; 10% of those go to another municipality; destination choice decays with distance (gravity exponent 1.5)
- 3 infectious people seeded at the start; background imports 0.05 per day per 100,000 people

## Mosquitoes (read-only assumptions)

- Start with 1.5 adults per person; 150-day mosquito-only warm-up before 2019
- Biting: 0.3 bites per mosquito per day
- Infection per bite: human to mosquito 0.5, mosquito to human 0.4
- Eggs: up to 0.8 female eggs per adult per day at the best temperature; none below 18 C or above 36 C
- Survival to emergence 0.9 when uncrowded
- Breeding sites: 0.3 of full in a dry spell, full at 100 mm of rain over 14 days
- Cleaning removes 50% of breeding capacity, and 10% of it returns each day
- Temperature rules (assumptions): egg-to-adult time 6-20 days, longer when cooler; mosquito incubation time 5-15 days, longer when cooler; daily adult death chance lowest near 27 C

## Fitted in M4 (current numbers are placeholders)

Biting rate, mosquito carrying capacity, reporting fraction, surge size.

## Open

- Data scope for fitting: 34 matched barangays vs all 242 (decide before M4)
- Publishing case data: privacy undecided; none is published now
- Name-map matches for Matacong and San Jose are unverified
- 2022, 2024, 2025 have no barangay-level cases and are shown as gaps
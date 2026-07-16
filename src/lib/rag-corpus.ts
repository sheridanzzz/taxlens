// RAG knowledge base: ATO work-related deduction guidance for individuals.
// Chunked by "## " headings at ingest time — keep each section self-contained,
// since the model only ever sees the 4 nearest sections, never the whole file.
// General guidance consistent with the rules TaxLens already encodes in
// constants.ts — not financial advice. Edit freely; changes re-ingest
// automatically (content hash check).
export const CORPUS = `## Working from home: fixed rate method

The fixed rate method lets you claim 67 cents per hour worked from home
(FY 2024-25 and 2025-26). The rate covers electricity and gas, internet,
mobile and home phone usage, stationery and computer consumables. Because
these are bundled into the rate, you cannot claim them again separately.
You CAN separately claim the decline in value of depreciating assets used
while working from home, such as a desk, chair, laptop or monitor, and
their repairs. To use this method you must keep a record of all hours
worked from home for the entire year, such as a timesheet, roster or
diary. An estimate or a representative four-week sample is not accepted.

## Working from home: actual cost method

The actual cost method lets you claim the work-related portion of your
actual expenses: electricity and gas, phone and internet, stationery and
consumables, cleaning of a dedicated home office, and decline in value of
home office furniture and equipment. You must work out the work-use
percentage of each expense on a reasonable basis, for example floor area
for energy costs or itemised usage for phone bills, and keep receipts for
every expense claimed. This method usually gives a larger deduction than
the fixed rate method when home office costs are high, but it requires
substantially more record keeping.

## Instant deduction for items 300 dollars or less

If a work-related item costs 300 dollars or less, you can claim an
immediate deduction for the full work-related portion in the year of
purchase. This applies per item: a 250 dollar keyboard and a 280 dollar
office chair are each immediately deductible. The 300 dollar limit
applies to the total cost of the item, not the work-related portion. It
does not apply to items that form part of a set costing more than 300
dollars in total, or to items bought primarily for producing rental or
investment income.

## Depreciation for items over 300 dollars

Work-related items costing more than 300 dollars cannot be claimed
outright. Instead you claim the decline in value (depreciation) over the
item's effective life, apportioned by work-use percentage. The deduction
starts from the date the item is first used or installed ready for use,
and the first year is pro-rated by days held. Two calculation methods are
available: diminishing value and prime cost. Once you choose a method for
an asset you must keep using it for that asset.

## Diminishing value versus prime cost

Diminishing value calculates each year's deduction as the asset's
remaining (base) value multiplied by 200 percent divided by the effective
life in years, giving larger deductions in the early years that taper
off. Prime cost claims the same amount every year: cost multiplied by 100
percent divided by the effective life. Both methods claim the same total
over the full effective life. Diminishing value is usually better because
deductions arrive sooner, especially if the asset will be replaced before
its effective life ends. Prime cost suits people who prefer even,
predictable deductions or expect a much higher income in later years.

## Effective life of common work assets

The ATO publishes effective lives used to calculate depreciation. Common
examples for office and computer equipment: laptops and desktop computers
4 years, monitors 4 years, headphones and headsets 3 years, keyboards and
mice 3 years, printers and scanners 5 years, webcams and microphones 4
years, external drives 5 years, desks 10 years, office chairs 10 years.
You may self-assess a different effective life if you can justify it, for
example heavy daily use shortening a laptop's realistic life.

## Work-use percentage and apportionment

If an item or service is used for both work and private purposes, you can
only claim the work-related portion. Estimate the percentage on a
reasonable, documented basis: for a phone plan, an itemised bill over a
representative four-week period; for a laptop, a diary of work versus
private hours. Claiming 100 percent work use for an item kept at home
invites ATO scrutiny — a home office chair that doubles as general
seating is more defensibly 80 to 90 percent. The work-use percentage
applies to both instant deductions and depreciation claims.

## Record keeping requirements

You must keep records that show you incurred the expense and how you
calculated the claim: receipts or invoices showing supplier, amount, date
and nature of the goods, plus usage records for apportioned items. Bank
statements alone are generally not sufficient. Records must be kept for
five years from the date you lodge the return. If your total claim for
work expenses exceeds 300 dollars, you need written evidence for the
whole amount, not just the excess. Digital copies such as photos of
receipts are acceptable if they are clear and complete.

## Self-education and professional development

Self-education expenses are deductible when the course, conference, book
or certification maintains or improves skills needed for your CURRENT
job, or is likely to increase your income from it. Examples for a
software engineer: a cloud certification, a programming course, a
technical conference. Not deductible: courses to obtain a new job or
switch careers, such as a developer studying nursing. Deductible costs
include course fees, textbooks, stationery and the work portion of
internet, but not costs reimbursed by an employer.

## Phone and internet expenses

You can claim the work-related portion of mobile phone and home internet
costs, based on a reasonable usage split such as a four-week itemised
diary applied across the year. If you use the working-from-home fixed
rate method, phone and internet are already included in the 67 cents per
hour and cannot be claimed again separately. Handsets over 300 dollars
are depreciated over their effective life rather than claimed outright.

## Clothing and laundry

Conventional clothing is never deductible, even if your employer requires
it — plain business attire or black pants for hospitality do not qualify.
Deductible categories are: compulsory uniforms with an employer logo,
registered non-compulsory uniforms, occupation-specific clothing such as
a chef's checked pants, and protective clothing such as steel-capped
boots or high-vis vests. Laundry of deductible clothing can be claimed at
1 dollar per load (50 cents if mixed with private items); claims over 150
dollars need records.

## Travel and car expenses

Travel between home and your regular workplace is private and not
deductible. Deductible travel includes trips between two workplaces,
travel to clients or alternative work sites, and trips to conferences or
training. Car costs can be claimed by the cents-per-kilometre method (88
cents per km in FY 2024-25, capped at 5,000 work kilometres per year, no
receipts needed but a diary of trips required) or the logbook method
(work percentage of all actual car costs, requiring a 12-week logbook and
receipts). Public transport, flights, tolls and parking for deductible
trips are claimed at cost.

## Union and professional association fees

Fees paid to a trade union or a professional association related to your
employment are fully deductible in the year paid, with no work-use
apportionment needed. Examples: union membership, engineering or
accounting body memberships, professional society subscriptions. Renewal
receipts or annual statements are sufficient evidence. Joining fees for a
new association are also deductible if the membership relates to your
current income-earning activities.`;

// Nivaz survey questions, version 1 — the same numbering as the "Nivaz Survey: Residents and PG Owners" doc.
// To change a question: edit its text or options here. To add one: give it a new id (e.g. A3.19) and,
// if the meaning of an existing question changes, raise `version` so old and new answers stay apart.
//
// Each question: id, q (question), t (type), o (options), core: 1 if it is in the short survey.
// Types: one = pick one · all = pick all (max = most picks) · top3 = pick 3 in order · stars = 1–5
//        nps = 0–10 · grid = rate each row (items) on a scale · num = a number · text = a short answer
// Extras: other (adds "Other" with a box) · only (an option that clears the others) · end (an option that
//         ends the survey) · when (show only if …) · ask (contact boxes for an option) · lead (a line above)
(function () {
  const LIVE = 'I live in a PG, hostel, co-living or 1 RK now';
  const PAST = 'I lived in one in the last 2 years';
  const LOOK = "I'm looking for one now or in the next 3 months";
  const has = (v, x) => Array.isArray(v) && v.includes(x);
  const lived = a => has(a['A1.2'], LIVE) || has(a['A1.2'], PAST);
  const MEALS = ['Breakfast', 'Lunch', 'Dinner'];
  const servesFood = a => !(Array.isArray(a['A2.6']) && a['A2.6'].length && !a['A2.6'].some(x => MEALS.includes(x)));
  const picks = id => a => (Array.isArray(a[id]) ? a[id].slice() : []);
  const twoPicks = id => a => picks(id)(a).length >= 2;

  const AREAS = ['Gachibowli', 'HITEC City/Madhapur', 'Kondapur', 'Financial District/Nanakramguda', 'Kukatpally/KPHB',
    'Ameerpet/SR Nagar', 'Ashok Nagar/Dilsukhnagar', 'Begumpet/Secunderabad', 'Uppal', 'Shamshabad'];
  const YMN = ['Yes', 'Maybe', 'No'];
  const MUST = ['Must have', 'Nice to have', "Don't need"];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Feature lists for A11 and B11 (core: 1 = in the short survey)
  const R_FEATURES = [
    { t: 'See the full monthly cost upfront (rent, food, electricity, extras)', core: 1 },
    { t: 'Pick your exact bed on the floor plan', core: 1 },
    { t: 'Hold a bed for 10 minutes while you book' },
    { t: 'Reserve a bed up to 15 days before moving in' },
    { t: 'Video tour and 360° photos', core: 1 },
    { t: '3D walkthrough (like Polycam)' },
    { t: 'Map and "distance to my office"', core: 1 },
    { t: 'Ratings from real residents, with pros and cons', core: 1 },
    { t: 'Nivaz Stars and a "Checked by Nivaz" badge' },
    { t: 'Move-in Guarantee', core: 1 },
    { t: 'Deposit Promise and refund record', core: 1 },
    { t: 'Roommate tags', core: 1 },
    { t: 'Trial night' },
    { t: 'Pay the deposit in parts' },
    { t: 'Pay rent in the app, with monthly receipts', core: 1 },
    { t: 'UPI AutoPay and reminders' },
    { t: 'Complaints with photos, tracked until fixed', core: 1 },
    { t: 'Food menu, meal skips and meal ratings', core: 1 },
    { t: 'Requests: late entry, night out, guest visit' },
    { t: 'Notices from the owner' },
    { t: 'Trusted resident record' },
    { t: 'Swap your bed when leaving early' },
    { t: 'Refer a friend and save on rent' },
    { t: 'Services: laundry pickup, tiffin, bike rental, movers, bedding kit' },
    { t: 'SOS safety button', core: 1 },
    { t: 'Chat with the owner inside the app' },
    { t: 'App in Telugu and Hindi' },
    { t: 'Rent bills and receipts shared with parents' }
  ];
  const O_FEATURES = [
    { t: 'Listing with floor plan and bed booking' },
    { t: 'Bed board: free and occupied beds at a glance', core: 1 },
    { t: 'Add a walk-in resident in 30 seconds', core: 1 },
    { t: 'QR self check-in for new residents', core: 1 },
    { t: 'Resident register for the police', core: 1 },
    { t: 'ID storage (owner only, deleted after move-out)' },
    { t: 'Rent bills, reminders and late fees', core: 1 },
    { t: 'UPI AutoPay for rent', core: 1 },
    { t: 'Receipts sent automatically' },
    { t: 'Deposit tracking and refund record' },
    { t: 'Complaints with photos', core: 1 },
    { t: 'Food menu, meal-skip counts and meal ratings', core: 1 },
    { t: 'Notices to residents' },
    { t: 'Approve late entry, night out and guest requests' },
    { t: 'Staff logins (warden, cook)', core: 1 },
    { t: 'Expenses and profit per property', core: 1 },
    { t: 'Several properties in one login' },
    { t: 'Reviews and replies', core: 1 },
    { t: 'Featured listing in busy months' },
    { t: 'Residents sent by companies and colleges' },
    { t: 'WhatsApp reminders', core: 1 },
    { t: 'Electricity bill split' },
    { t: 'Grocery and stock tracking' },
    { t: 'Rent insights: your rent vs the area average' },
    { t: 'Licence renewal reminders' }
  ];
  const featureNames = list => mode => list.filter(f => mode === 'full' || f.core).map(f => f.t);

  const resident = [
    { id: 'A1', title: 'Who you are', qs: [
      { id: 'A1.1', core: 1, consent: 1, q: 'Do you agree to take part?', t: 'one', o: ['Yes', 'No'], end: { No: 'declined' } },
      { id: 'A1.2', core: 1, req: 1, q: 'Which of these describes you?', t: 'all', o: [LIVE, PAST, LOOK, 'None of these'], only: 'None of these', end: { 'None of these': 'not_for_you' } },
      { id: 'A1.3', core: 1, req: 1, q: 'Your age group', t: 'one', o: ['Under 18', '18–21', '22–25', '26–30', '31–35', '36–45', '46+'], end: { 'Under 18': 'under18' } },
      { id: 'A1.4', q: 'Gender', t: 'one', o: ['Woman', 'Man', 'Non-binary', 'Prefer not to say'] },
      { id: 'A1.5', core: 1, q: 'What do you do?', t: 'one', o: ['Working in IT/software', 'Working, other job', 'College student', 'Preparing for exams/coaching', 'Intern or trainee', 'Own business', 'Looking for a job'], other: 1 },
      { id: 'A1.6', core: 1, q: 'Where do you work or study?', t: 'one', o: AREAS.concat(['Work from home']), other: 1 },
      { id: 'A1.7', q: 'Your company or college (optional)', t: 'text' },
      { id: 'A1.8', q: 'Your home town is in', t: 'one', o: ['Hyderabad', 'Rest of Telangana', 'Andhra Pradesh', 'Another South Indian state', 'North, East or West India', 'Outside India'] },
      { id: 'A1.9', q: 'When did you move to Hyderabad?', t: 'one', o: ['Grew up here', 'Over 2 years ago', '1–2 years ago', 'In the last year', 'Moving in the next 3 months'] },
      { id: 'A1.10', q: 'How long do you plan to stay in Hyderabad?', t: 'one', o: ['Under 6 months', '6–12 months', '1–2 years', 'Over 2 years', 'Not sure'] },
      { id: 'A1.11', q: 'Your monthly income or allowance', t: 'one', o: ['Under ₹20k', '₹20–40k', '₹40–75k', '₹75k–1.5 lakh', 'Over ₹1.5 lakh', 'Prefer not to say'] },
      { id: 'A1.12', q: 'Who pays your rent?', t: 'one', o: ['Me', 'Parents or family', 'My company', 'Shared'] },
      { id: 'A1.13', q: "Languages you're comfortable using in an app", t: 'all', o: ['English', 'Telugu', 'Hindi', 'Tamil', 'Kannada', 'Malayalam'], other: 1 }
    ] },
    { id: 'A2', title: 'Your current or last stay', when: lived, lead: 'About the place you live in now, or the last one.', qs: [
      { id: 'A2.1', core: 1, q: 'What kind of place is it?', t: 'one', o: ['PG', 'Hostel', 'Branded co-living (Stanza, Zolo, Colive, etc.)', '1 RK/studio', 'Shared flat', 'Company or college hostel'], other: 1 },
      { id: 'A2.2', q: 'Which area is it in?', t: 'one', o: AREAS, other: 1 },
      { id: 'A2.3', q: "It's for", t: 'one', o: ['Women only', 'Men only', 'Everyone'] },
      { id: 'A2.4', core: 1, q: 'How many people share your room?', t: 'one', o: ['Just me', '2', '3', '4', '5 or more'] },
      { id: 'A2.5', core: 1, q: 'Your monthly rent (your share)', t: 'one', o: ['Under ₹5k', '₹5–7k', '₹7–9k', '₹9–12k', '₹12–15k', '₹15–20k', 'Over ₹20k'] },
      { id: 'A2.6', q: "What's included in the rent?", t: 'all', o: ['Breakfast', 'Lunch', 'Dinner', 'Wi-Fi', 'Electricity', 'Water', 'Housekeeping', 'Laundry', 'AC', 'Hot water', 'Power backup', 'Parking', 'Gym', 'Nothing extra'], only: 'Nothing extra' },
      { id: 'A2.7', q: 'Extra charges on top of rent', t: 'all', o: ['Electricity meter', 'AC', 'Food', 'Laundry', 'Maintenance', 'Wi-Fi', 'Water', 'None'], only: 'None' },
      { id: 'A2.8', q: 'Roughly how much extra per month?', t: 'one', o: ['Nothing', 'Under ₹500', '₹500–1,000', '₹1,000–2,000', 'Over ₹2,000'] },
      { id: 'A2.9', core: 1, q: 'Security deposit you paid', t: 'one', o: ['None', "Less than 1 month's rent", '1 month', '2 months', 'More than 2 months'] },
      { id: 'A2.10', q: 'Your washroom is', t: 'one', o: ['Attached to the room', 'Shared on the floor', 'Common for the building'] },
      { id: 'A2.11', q: 'How long have you stayed (or did you stay)?', t: 'one', o: ['Under 1 month', '1–3 months', '3–6 months', '6–12 months', '1–2 years', 'Over 2 years'] },
      { id: 'A2.12', q: 'How many PGs have you lived in, in Hyderabad?', t: 'one', o: ['1', '2', '3', '4 or more'] },
      { id: 'A2.13', q: 'How do you get to work or college?', t: 'one', o: ['Walk', 'Own bike/scooter', 'Bus', 'Metro', 'Auto/cab', 'Company shuttle', 'Work from home'] },
      { id: 'A2.14', q: 'How long does it take?', t: 'one', o: ['Under 10 min', '10–20 min', '20–40 min', '40–60 min', 'Over 1 hour'], when: a => a['A2.13'] !== 'Work from home' },
      { id: 'A2.15', q: 'How happy are you with the commute?', t: 'stars', when: a => a['A2.13'] !== 'Work from home' }
    ] },
    { id: 'A3', title: 'Searching and choosing', lead: "If you're looking now, answer about your search. Otherwise, about how you found your current or last place.", qs: [
      { id: 'A3.1', core: 1, q: 'How did you find your PG (or how are you searching)?', t: 'all', o: ['Walked around/boards', 'Friend or colleague', 'Google Maps/Search', 'NoBroker, Housing, MagicBricks or 99acres', "A co-living brand's app or site", 'Facebook, WhatsApp or Telegram group', 'Broker', 'Company or college', 'Instagram or YouTube', 'JustDial'], other: 1 },
      { id: 'A3.2', q: 'Which one actually found you the place?', t: 'one', o: picks('A3.1'), when: a => lived(a) && twoPicks('A3.1')(a) },
      { id: 'A3.3', q: 'Did you pay a broker? How much?', t: 'one', o: ['No', 'Under ₹1,000', '₹1,000–3,000', "Half a month's rent", "A month's rent or more"], when: lived },
      { id: 'A3.4', q: 'How many PGs did you visit before choosing?', t: 'one', o: ['1', '2–3', '4–6', '7–10', 'More than 10'] },
      { id: 'A3.5', q: 'How long did the search take?', t: 'one', o: ['Same day', '2–3 days', 'About a week', '2–4 weeks', 'Over a month'], when: lived },
      { id: 'A3.6', core: 1, q: 'Did you choose your PG before arriving in Hyderabad?', t: 'one', o: ['Yes, booked from another city', 'Stayed with friends or in a hotel first, then searched', 'Already lived in Hyderabad'] },
      { id: 'A3.7', q: 'If you stayed somewhere while searching, for how many nights?', t: 'one', o: ["Didn't need to", '1–2 nights', '3–7 nights', '8 or more'] },
      { id: 'A3.8', core: 1, q: 'The 5 things that matter most when choosing', t: 'all', max: 5, o: ['Rent', 'Distance to work/college', 'Food', 'Cleanliness', 'Safety', 'Wi-Fi', 'Owner/warden behaviour', 'Rules and timings', 'Room size', 'Attached washroom', 'AC', 'Reviews from residents', 'Photos and videos', 'Deposit amount', 'Notice period', 'Short stays allowed', 'Roommates', 'Laundry', 'Gym', 'Parking', 'Power backup', 'Water supply', 'Near metro or bus', "Women's safety"], other: 1 },
      { id: 'A3.9', q: 'Of those, the single most important', t: 'one', o: picks('A3.8'), when: twoPicks('A3.8') },
      { id: 'A3.10', core: 1, q: 'What annoyed you while searching?', t: 'all', o: ["Photos didn't match", 'Hidden charges', 'Rent not shown upfront', "Owners didn't reply", 'Broker fees', 'Fake or old listings', 'Bed gone when I arrived', 'Too many visits', 'No honest reviews', 'Pushed to pay a token fast', 'Unclear rules', 'Deposit too high', 'Nothing'], only: 'Nothing', other: 1 },
      { id: 'A3.11', q: 'Have you ever paid a token and lost it?', t: 'one', o: ['No', 'Yes, under ₹1,000', 'Yes, ₹1,000–5,000', 'Yes, over ₹5,000'] },
      { id: 'A3.12', q: 'Have you arrived to find the room different from what was promised?', t: 'one', o: ['Never', 'Once', 'More than once'], when: lived },
      { id: 'A3.13', core: 1, q: 'What would make you book a bed without visiting?', t: 'all', max: 3, o: ['Checked in person by Nivaz', 'Video or 360° tour', 'Reviews from real residents', "Full refund if it doesn't match", "Owner's ID verified", 'Talking to a current resident', 'Map and street photos', 'One trial night', 'Nothing, I must visit'], only: 'Nothing, I must visit' },
      { id: 'A3.14', q: 'How useful is each?', t: 'grid', scale: 'stars', items: ['Photos', 'Short video walkthrough', '360° photos', '3D walkthrough (like Polycam)', 'Live video call with the owner', 'Floor plan showing my exact bed'] },
      { id: 'A3.15', q: 'How useful: sort PGs by distance from my office or college', t: 'stars' },
      { id: 'A3.16', q: 'How useful: a map of all PGs with their rents', t: 'stars' },
      { id: 'A3.17', q: 'Would you let the app use your location to show PGs near you?', t: 'one', o: ['Yes', 'Only while using the app', "No, I'd rather type the area"] },
      { id: 'A3.18', q: 'How much do nearby places matter (food, gym, market, hospital, metro)?', t: 'stars' }
    ] },
    { id: 'A4', title: 'Visits, token and move-in', qs: [
      { id: 'A4.1', q: 'How did you arrange your visit?', t: 'one', o: ['Just walked in', 'Called the owner', 'Through an app or website', 'A broker took me', "Didn't visit before moving in"], when: lived },
      { id: 'A4.2', q: 'How did you pay the token or advance?', t: 'one', o: ['No token', 'Cash', 'UPI to the owner', 'Bank transfer', 'Card', 'Through an app'], when: lived },
      { id: 'A4.3', q: 'Token amount', t: 'one', o: ['Under ₹1,000', '₹1,000–2,000', '₹2,000–5,000', 'Over ₹5,000'], when: a => lived(a) && a['A4.2'] !== 'No token' },
      { id: 'A4.4', q: "When did you pay the first month's rent?", t: 'one', o: ['Before moving in', 'On move-in day', 'In the first week'], other: 1, when: lived },
      { id: 'A4.5', q: 'Did you get a receipt for the token and first month?', t: 'one', o: ['Yes, written or digital', 'Only a WhatsApp message', 'No'], when: lived },
      { id: 'A4.6', q: 'Was there a written agreement or rules sheet?', t: 'one', o: ['Signed agreement', 'Rules sheet only', 'Told verbally', 'Nothing'], when: lived },
      { id: 'A4.7', q: 'Which documents were you asked for?', t: 'all', o: ['Aadhaar copy', 'PAN', 'Office or college ID', 'Photo', 'Police verification form', 'Parent or guardian contact', 'Offer letter', 'None'], only: 'None', other: 1, when: lived },
      { id: 'A4.8', q: 'How do you feel about giving ID copies to PG owners?', t: 'one', o: ['Comfortable', 'OK, but worried about misuse', 'Uncomfortable', 'Only if the law requires it'], when: lived },
      { id: 'A4.9', q: 'Would you rather upload your ID in the app, seen only by your PG owner and deleted after you move out?', t: 'one', o: ['Yes', 'No, a paper copy is fine', 'Not sure'], when: lived },
      { id: 'A4.10', core: 1, lead: "Move-in Guarantee: pay the first month in the app and Nivaz holds it until you move in. If the bed isn't there or doesn't match the photos, you get a full refund and help finding a bed that night.", q: 'How likely are you to pay the first month in the app?', t: 'nps' },
      { id: 'A4.11', core: 1, q: 'What would make you pay the first month in the app instead of at the PG?', t: 'top3', o: ['Move-in Guarantee', '₹300 cashback', 'Pay by card or EMI', 'Monthly receipts for HRA', 'Deposit Promise', 'Nothing, I prefer paying the owner'], only: 'Nothing, I prefer paying the owner' },
      { id: 'A4.12', q: 'Would you pay the deposit in 3 monthly parts?', t: 'one', o: ['Yes, even with a small fee', "Only if there's no fee", 'No'] },
      { id: 'A4.13', lead: 'Trial night: stay one night first. If you stay on, the amount is taken off your rent.', q: 'Would you pay ₹300–600 for a trial night?', t: 'one', o: YMN },
      { id: 'A4.14', q: 'Would you reserve a bed now for a move-in up to 15 days later?', t: 'one', o: YMN },
      { id: 'A4.15', q: 'What went wrong on move-in day?', t: 'all', o: ['Room not ready or not clean', 'Different bed', 'Missing items (mattress, cupboard)', 'New charges announced', 'Long paperwork', 'Nothing'], only: 'Nothing', other: 1, when: lived },
      { id: 'A4.16', q: 'How easy was moving in?', t: 'stars', when: lived }
    ] },
    { id: 'A5', title: 'Rate your PG', when: lived, qs: [
      { id: 'A5.1', core: 1, q: 'Overall, how would you rate your PG?', t: 'stars' },
      { id: 'A5.2', core: 1, q: 'Rate each part of your PG', t: 'grid', scale: 'stars', items: ['Food', 'Room cleanliness', 'Washroom cleanliness', 'Safety', 'Wi-Fi', 'Water and hot water', 'Power backup', 'Owner/warden behaviour', 'Speed of repairs', 'Value for money', 'Quiet for sleep and study', 'Fair rules and timings', 'Laundry', 'Privacy', 'Furniture and mattress'] },
      { id: 'A5.3', core: 1, q: 'The best things about it', t: 'all', max: 3, o: ['Good food', 'Clean washrooms', 'Friendly owner', 'Strong Wi-Fi', 'Near office or metro', 'Safe for women', 'Quick repairs', 'Spacious rooms', 'Good roommates', 'Value for money', 'Flexible timings', 'Power backup', 'Hot water', 'Daily housekeeping'], other: 1 },
      { id: 'A5.4', core: 1, q: 'The worst things about it', t: 'all', max: 3, o: ['Poor food', 'Dirty washrooms', 'Rude owner or staff', 'Weak Wi-Fi', 'Water problems', 'Strict timings', 'Slow repairs', 'Small rooms', 'Noisy', 'Pests', 'Power cuts', 'Hidden charges', 'Deposit problems', 'Overcrowded', 'Unsafe area'], other: 1 },
      { id: 'A5.5', q: 'One thing the owner should change', t: 'text' },
      { id: 'A5.6', q: 'How well does it match what you were shown before moving in?', t: 'stars' },
      { id: 'A5.7', q: 'Who should be allowed to rate a PG on Nivaz?', t: 'one', o: ['Only residents of 30+ days', 'Residents of 7+ days', 'Any resident', 'Anyone who visited'] }
    ] },
    { id: 'A6', title: 'Food and meals', when: a => lived(a) && servesFood(a), qs: [
      { id: 'A6.1', q: 'Which meals do you eat at the PG on weekdays?', t: 'all', o: ['Breakfast', 'Lunch', 'Dinner', 'None'], only: 'None' },
      { id: 'A6.2', q: 'And at weekends?', t: 'all', o: ['Breakfast', 'Lunch', 'Dinner', 'None'], only: 'None' },
      { id: 'A6.3', q: 'How many meals do you skip in a week?', t: 'one', o: ['0', '1–3', '4–7', '8 or more'] },
      { id: 'A6.4', q: 'Do you tell the kitchen when you skip?', t: 'one', o: ['Always', 'Sometimes', 'Never', "There's no way to tell"] },
      { id: 'A6.5', core: 1, q: 'Would you mark meal skips in the app if it cut food waste or earned you credit?', t: 'one', o: ['Yes, even without credit', 'Only if I get credit', 'No'] },
      { id: 'A6.6', q: 'Should skipped meals lower your rent?', t: 'one', o: ['Yes, per meal', 'Only for whole days away', 'No, keep rent simple'] },
      { id: 'A6.7', q: 'Your food', t: 'one', o: ['Veg', 'Egg', 'Non-veg', 'Jain', 'Vegan'] },
      { id: 'A6.8', q: 'Food style you prefer', t: 'all', o: ['South Indian', 'North Indian', 'Andhra/Telangana spicy', 'Mild', 'Healthy/diet'] },
      { id: 'A6.9', q: 'Rate the food', t: 'grid', scale: 'stars', items: ['Taste', 'Quantity', 'Variety', 'Hygiene', 'Timing'] },
      { id: 'A6.10', q: 'Would you like the weekly menu in the app?', t: 'one', o: ['Yes', "Don't mind"] },
      { id: 'A6.11', q: 'Would you rate each meal with a thumbs up or down?', t: 'one', o: ['Yes', 'Sometimes', 'No'] },
      { id: 'A6.12', q: 'Monthly spend on outside food and delivery apps', t: 'one', o: ['Under ₹1,000', '₹1,000–3,000', '₹3,000–5,000', 'Over ₹5,000'] },
      { id: 'A6.13', q: 'Would you pay for add-ons?', t: 'all', o: ['Extra items (egg, curd)', 'Special Sunday meal', 'Lunch box to office', 'No'], only: 'No' }
    ] },
    { id: 'A7', title: 'Complaints, requests, notices, safety and roommates', when: lived, qs: [
      { id: 'A7.1', q: 'How do you raise a complaint now?', t: 'one', o: ['Tell the warden', 'Call the owner', 'WhatsApp', 'Complaint book', "I don't bother"] },
      { id: 'A7.2', core: 1, q: 'How long does a repair usually take?', t: 'one', o: ['Same day', '1–2 days', '3–7 days', 'Over a week', 'Never fixed'] },
      { id: 'A7.3', q: "Problems you've had in the last 3 months", t: 'all', o: ['Plumbing', 'Electrical', 'Wi-Fi down', 'Pests', 'Water shortage', 'Food', 'Cleaning', 'Noise', 'Theft', 'Roommates', 'Staff behaviour', 'Power cuts', 'Broken furniture', 'AC', 'None'], only: 'None', other: 1 },
      { id: 'A7.4', q: 'How useful: raise a complaint with a photo and track it until fixed', t: 'stars' },
      { id: 'A7.5', q: 'How are late entry, night out and guest requests handled now?', t: 'one', o: ['Ask in person', 'WhatsApp', 'Register at the gate', 'Not allowed', 'Never needed'] },
      { id: 'A7.6', q: 'How useful: send these requests in the app and get a yes or no', t: 'stars' },
      { id: 'A7.7', q: 'How does the owner share notices (water cuts, rent changes, rules)?', t: 'all', o: ['WhatsApp group', 'Notice board', 'Word of mouth', 'Phone calls', "They don't"], only: "They don't" },
      { id: 'A7.8', q: 'Have you missed an important notice?', t: 'one', o: ['Often', 'Once or twice', 'Never'] },
      { id: 'A7.9', core: 1, q: 'How safe do you feel at your PG?', t: 'stars' },
      { id: 'A7.10', q: 'Safety features at your PG', t: 'all', o: ['CCTV', 'Security guard', 'Biometric or card entry', 'Visitor register', 'Fire extinguishers', 'Woman warden', 'Lighting outside at night', 'None'], only: 'None', other: 1 },
      { id: 'A7.11', q: 'Would you want an SOS button that alerts the warden and your emergency contact?', t: 'one', o: YMN },
      { id: 'A7.12', q: 'How were your roommates chosen?', t: 'one', o: ['The owner placed me', 'I chose', 'Came with friends', "Don't know"] },
      { id: 'A7.13', q: 'Have you had roommate problems?', t: 'one', o: ['Often', 'Sometimes', 'Never'] },
      { id: 'A7.14', core: 1, q: 'Would you like to see simple tags for the people in a room (no names or photos) before picking a bed?', t: 'one', o: YMN },
      { id: 'A7.15', q: 'Which tags matter most?', t: 'all', max: 4, o: ['Working or student', 'Veg or non-veg', 'Sleep time', 'Language', 'Smoking', 'Drinking', 'Night shifts', 'Tidy', 'Quiet or social', 'Age group'], when: a => !!a['A7.14'] && a['A7.14'] !== 'No' },
      { id: 'A7.16', q: 'Would you show your own tags to others?', t: 'one', o: ['Yes', 'Some of them', 'No'], when: a => !!a['A7.14'] && a['A7.14'] !== 'No' }
    ] },
    { id: 'A8', title: 'Rent and payments', when: lived, qs: [
      { id: 'A8.1', core: 1, q: 'How do you pay rent?', t: 'one', o: ['Cash', "UPI to the owner's number", "Owner's QR code", 'Bank transfer', 'Through an app', 'Card'] },
      { id: 'A8.2', q: 'Which UPI app do you use most?', t: 'one', o: ['Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'Bank app', 'CRED', 'Amazon Pay'], other: 1 },
      { id: 'A8.3', q: 'When is rent due now?', t: 'one', o: ['1st–5th', '6th–10th', '11th–20th', '21st–month end', 'Same date as move-in'] },
      { id: 'A8.4', q: 'When would you like it due?', t: 'one', o: ['1st–5th', '6th–10th', 'Right after my salary or allowance', 'Same date as move-in'] },
      { id: 'A8.5', q: 'Have you paid late?', t: 'one', o: ['Never', 'Once or twice', 'Often'] },
      { id: 'A8.6', q: 'Is there a late fee?', t: 'one', o: ['No', 'Yes, a fixed amount', 'Yes, per day', "Don't know"] },
      { id: 'A8.7', q: 'How fair is the late fee?', t: 'stars', when: a => a['A8.6'] === 'Yes, a fixed amount' || a['A8.6'] === 'Yes, per day' },
      { id: 'A8.8', q: 'Do you get a monthly rent receipt?', t: 'one', o: ['Every month', 'Only when I ask', 'Never'] },
      { id: 'A8.9', core: 1, q: 'Do you claim HRA (house rent allowance) in your income tax?', t: 'one', o: ['Yes', 'No', "Don't know what that is"] },
      { id: 'A8.10', q: 'Would you set up UPI AutoPay so rent is paid on the due date?', t: 'one', o: YMN },
      { id: 'A8.11', q: 'Would you pay rent by credit card for about 1.5–2% extra?', t: 'one', o: ['Yes, often', 'Sometimes', 'No'] },
      { id: 'A8.12', q: 'How clear are your bills (rent, electricity, extras)?', t: 'stars' },
      { id: 'A8.13', q: 'Have you had a dispute about rent or charges?', t: 'one', o: ['Never', 'Once', 'More than once'] },
      { id: 'A8.14', q: 'Where would you like rent reminders?', t: 'one', o: ['App notification', 'WhatsApp', 'SMS', 'Email'] }
    ] },
    { id: 'A9', title: 'Moving out and deposit', when: lived, qs: [
      { id: 'A9.1', q: 'Notice period at your PG', t: 'one', o: ['None', '7 days', '15 days', '30 days', 'Longer'] },
      { id: 'A9.2', core: 1, q: 'When you left a PG, did you get your deposit back?', t: 'one', o: ["Haven't left one yet", 'Full, within a week', 'Full, but after 2+ weeks', 'Only part', 'Not at all', 'Still waiting'] },
      { id: 'A9.3', q: 'Reasons given for cutting it', t: 'all', o: ['Damage', 'Cleaning fee', 'Notice not served', 'Unpaid bills', 'No reason given', 'Nothing cut'], only: 'Nothing cut', when: a => !!a['A9.2'] && a['A9.2'] !== "Haven't left one yet" },
      { id: 'A9.4', q: 'How long did the refund take?', t: 'one', o: ['Same day', '1–7 days', '1–4 weeks', 'Over a month', 'Never came'], when: a => !!a['A9.2'] && a['A9.2'] !== "Haven't left one yet" },
      { id: 'A9.5', q: "How much would an owner's public deposit-refund record affect your choice?", t: 'stars', lo: 'Not at all', hi: 'A lot' },
      { id: 'A9.6', q: 'Would you use a photo checklist at move-in and move-out?', t: 'one', o: YMN },
      { id: 'A9.7', lead: 'Swap: leave early with no notice penalty if someone books your bed on Nivaz.', q: 'Would you use it?', t: 'one', o: YMN },
      { id: 'A9.8', core: 1, q: 'Why did you (or would you) leave a PG?', t: 'all', max: 3, o: ['Job or college change', 'Food', 'Cleanliness', 'Owner behaviour', 'Rent increase', 'Moving to a flat', 'Found a better PG', 'Commute', 'Roommates', 'Leaving Hyderabad', 'Safety'], other: 1 },
      { id: 'A9.9', q: "What's your next plan?", t: 'one', o: ['Stay here', 'Another PG', 'Flat with friends', 'Own home', 'Leave Hyderabad', 'Not sure'] },
      { id: 'A9.10', q: 'Would you like a "Trusted resident" record (on-time rent, good conduct) that could lower your deposit at your next PG?', t: 'one', o: YMN }
    ] },
    { id: 'A10', title: 'Reviews and ratings', qs: [
      { id: 'A10.1', q: 'Do you read reviews before choosing a PG?', t: 'one', o: ['Always', 'Sometimes', 'Never'] },
      { id: 'A10.2', q: 'Where?', t: 'all', o: ['Google', 'Apps', 'Friends', 'Social media groups', 'Nowhere'], only: 'Nowhere', when: a => a['A10.1'] !== 'Never' },
      { id: 'A10.3', q: 'How much do you trust Google reviews of PGs?', t: 'stars' },
      { id: 'A10.4', q: 'Why not more?', t: 'all', o: ['Owners write them', 'Too few', 'Too old', 'Only angry people write'], other: 1, when: a => typeof a['A10.3'] === 'number' && a['A10.3'] <= 3 },
      { id: 'A10.5', core: 1, q: 'Would you review your PG in the app if only real residents can review?', t: 'one', o: ['Yes, with my name', 'Yes, shown as "Resident, IT professional"', 'No'] },
      { id: 'A10.6', q: 'Would you worry the owner might treat you badly after a bad review?', t: 'one', o: ['Yes', 'A little', 'No'] },
      { id: 'A10.7', q: 'When should Nivaz ask you for a review?', t: 'one', o: ['After 30 days', 'After 3 months', 'When moving out', 'Whenever I choose'] },
      { id: 'A10.8', lead: 'Nivaz Stars: ★ to ★★★★★ based on facilities, checked in person.', q: 'How useful would Nivaz Stars be?', t: 'stars' },
      { id: 'A10.9', q: 'Which facilities should count most for Nivaz Stars?', t: 'top3', o: ['Food', 'Attached washroom', 'AC', 'Wi-Fi', 'Security', 'Housekeeping', 'Laundry', 'Power backup', 'Lift', 'Gym', 'RO water'] },
      { id: 'A10.10', q: 'Should owners be able to reply to reviews?', t: 'one', o: ['Yes', 'No'] },
      { id: 'A10.11', q: 'How much would a "Checked by Nivaz" badge raise your trust?', t: 'stars' }
    ] },
    { id: 'A11', title: 'Features: what matters to you', qs: [
      { id: 'A11.1', core: 1, q: 'For each feature: must have, nice to have, or don\'t need?', t: 'grid', scale: MUST, items: featureNames(R_FEATURES) },
      { id: 'A11.2', core: 1, q: 'Your top 3 features', t: 'top3', o: (a, mode) => featureNames(R_FEATURES)(mode) },
      { id: 'A11.3', q: "Anything missing that you'd want?", t: 'text' },
      { id: 'A11.4', q: 'What would make you uninstall an app like this?', t: 'all', o: ['Too many notifications', 'Asks for too much personal info', 'Ads', 'Slow or heavy app', 'Nothing'], only: 'Nothing', other: 1 }
    ] },
    { id: 'A12', title: "Rewards and what you'd pay", qs: [
      { id: 'A12.1', q: 'Would you pay a small booking fee in the app if it included the Move-in Guarantee?', t: 'one', o: ['No', 'Up to ₹49', 'Up to ₹99', 'Up to ₹199', 'Up to ₹299', 'More'] },
      { id: 'A12.2', core: 1, q: 'Which reward would most make you book through the app?', t: 'one', o: ['₹300–500 cashback', 'Discount on the first month', 'A free week of laundry', 'Welcome kit (bedsheet, pillow, bucket)', 'The guarantee is enough', 'None needed'] },
      { id: 'A12.3', q: 'What reward would make you refer a friend?', t: 'one', o: ['₹200 off rent each', '₹500 each', '₹1,000 each', "I'd refer for free", "I wouldn't refer"] },
      { id: 'A12.4', q: 'Which paid services would you use?', t: 'grid', scale: ['Would use', 'Maybe', 'No'], items: ['Laundry pickup', 'Room cleaning', 'Tiffin or lunch box', 'Bike or scooter rental', 'Mattress and bedding kit', 'Movers', 'Furniture rental', 'Faster Wi-Fi'] },
      { id: 'A12.5', q: 'Monthly spend on services like these', t: 'one', o: ['₹0', 'Under ₹500', '₹500–1,500', '₹1,500–3,000', 'Over ₹3,000'] },
      { id: 'A12.6', q: 'Would an on-time rent streak (a badge, then a small discount) motivate you?', t: 'one', o: ['Yes', 'A little', 'No'] },
      { id: 'A12.7', q: 'How much lower would the app price need to be for you to book in the app instead of walking in?', t: 'one', o: ['Same price is fine', '₹200', '₹500', '₹1,000'] }
    ] },
    { id: 'A13', title: 'Phone, language and privacy', qs: [
      { id: 'A13.1', q: 'Your phone', t: 'one', o: ['Android', 'iPhone', 'Both'] },
      { id: 'A13.2', q: 'Do you delete apps to save space?', t: 'one', o: ['Often', 'Sometimes', 'Never'] },
      { id: 'A13.3', q: 'How do you prefer updates from your PG?', t: 'one', o: ['App notification', 'WhatsApp', 'SMS', 'Call', 'Email'] },
      { id: 'A13.4', q: 'How would you like to log in?', t: 'one', o: ['SMS code (OTP)', 'Google account', 'Password'] },
      { id: 'A13.5', core: 1, q: 'What are you comfortable sharing in the app?', t: 'all', o: ['Phone number (with the owner after booking)', 'Emergency contact', 'ID photo (owner only)', 'Office or college name', 'Profile photo', 'None'], only: 'None' },
      { id: 'A13.6', q: 'What worries you most about apps like this?', t: 'all', o: ['Data sold or spam calls', 'Owner misusing my ID', 'Fake listings', 'Payment safety', 'Nothing'], only: 'Nothing', other: 1 },
      { id: 'A13.7', q: 'Would you keep the app after moving in, for rent, complaints and food?', t: 'one', o: ['Yes', 'Only if my owner uses it', 'No'] },
      { id: 'A13.8', q: "App language you'd choose", t: 'one', o: ['English', 'Telugu', 'Hindi'], other: 1 }
    ] },
    { id: 'A14', title: 'Wrap-up', qs: [
      { id: 'A14.1', q: 'How likely are you to recommend your current PG to a friend?', t: 'nps', when: lived },
      { id: 'A14.2', core: 1, q: 'How likely are you to use an app like Nivaz for your next PG?', t: 'nps' },
      { id: 'A14.3', q: 'Why that score?', t: 'text' },
      { id: 'A14.4', q: 'One thing that would make PG life better', t: 'text' },
      { id: 'A14.5', core: 1, lead: 'Testers keep the app installed for 14 days and tell us what to fix.', q: 'Would you like to test Nivaz before launch?', t: 'one', o: ['Yes', 'No'], ask: { Yes: ['gmail', 'phone'] }, flag: 'testing' },
      { id: 'A14.6', q: 'Can we call you for a 15-minute follow-up chat?', t: 'one', o: ['Yes', 'No'], ask: { Yes: ['phone'] }, flag: 'call' },
      { id: 'A14.7', q: 'Would you like to join the lucky draw?', t: 'one', o: ['Yes', 'No'], ask: { Yes: ['phone'] }, flag: 'draw' }
    ] }
  ];

  const owner = [
    { id: 'B1', title: 'About you and your PG', lead: 'If you run several PGs, answer about the main one.', qs: [
      { id: 'B1.1', core: 1, q: 'Your role', t: 'one', o: ['Owner', 'Family member who runs it', 'Manager', 'Warden', 'Partner or investor'] },
      { id: 'B1.2', core: 1, q: 'How many PG or hostel properties do you run?', t: 'one', o: ['1', '2–3', '4–10', 'Over 10'] },
      { id: 'B1.3', q: 'Years running PGs', t: 'one', o: ['Under 1', '1–3', '3–5', '5–10', 'Over 10'] },
      { id: 'B1.4', q: 'Do you own the building or lease it?', t: 'one', o: ['Own', 'Lease', 'Some of each'] },
      { id: 'B1.5', core: 1, q: 'Type of property', t: 'one', o: ['PG', 'Hostel', 'Co-living', '1 RK/studios', 'Service apartments', 'Mixed'] },
      { id: 'B1.6', core: 1, q: 'Area', t: 'one', o: AREAS, other: 1 },
      { id: 'B1.7', q: "It's for", t: 'one', o: ['Women', 'Men', 'Everyone'] },
      { id: 'B1.8', core: 1, q: 'Total beds', t: 'one', o: ['Under 20', '20–50', '51–100', '101–200', 'Over 200'] },
      { id: 'B1.9', core: 1, q: 'Rent per bed for each sharing type', t: 'grid', scale: ['Under ₹5k', '₹5–7k', '₹7–9k', '₹9–12k', '₹12–15k', 'Over ₹15k', "Don't offer"], items: ['Single', '2-sharing', '3-sharing', '4-sharing', '5 or more'] },
      { id: 'B1.10', q: 'Food you serve', t: 'one', o: ['All 3 meals', '2 meals', 'Breakfast only', 'Optional add-on', 'No food'] },
      { id: 'B1.11', q: 'Kitchen', t: 'one', o: ['Own cook', 'Outside caterer', 'No kitchen'], when: a => a['B1.10'] !== 'No food' },
      { id: 'B1.12', q: 'Amenities you provide', t: 'all', o: ['Wi-Fi', 'AC rooms', 'Attached washrooms', 'Housekeeping', 'Washing machine', 'Power backup', 'RO water', 'Hot water', 'CCTV', 'Security guard', 'Lift', 'Gym', 'Parking', 'Biometric entry', 'Common room'], other: 1 },
      { id: 'B1.13', core: 1, q: 'Average occupancy in the last 12 months', t: 'one', o: ['Under 50%', '50–70%', '70–85%', '85–95%', 'Over 95%'] },
      { id: 'B1.14', q: 'Busiest months', t: 'all', o: MONTHS },
      { id: 'B1.15', q: 'Slowest months', t: 'all', o: MONTHS },
      { id: 'B1.16', q: 'How long do residents usually stay?', t: 'one', o: ['Under 3 months', '3–6 months', '6–12 months', '1–2 years', 'Longer'] },
      { id: 'B1.17', q: 'Your residents are mostly', t: 'one', o: ['Working', 'Students', 'Exam aspirants', 'Mixed'] },
      { id: 'B1.18', core: 1, q: 'Deposit you take', t: 'one', o: ['None', 'Under 1 month', '1 month', '2 months', 'More'] },
      { id: 'B1.19', q: 'Notice period', t: 'one', o: ['None', '7 days', '15 days', '30 days'] },
      { id: 'B1.20', q: 'Your token', t: 'one', o: ['No token', 'Refundable', 'Adjusted in rent', 'Non-refundable'] }
    ] },
    { id: 'B2', title: 'Finding residents', qs: [
      { id: 'B2.1', core: 1, q: 'Where do new residents come from?', t: 'grid', scale: ['None', 'Some', 'Most'], items: ['Walk-ins and boards', 'Referrals from residents', 'Google Maps', 'NoBroker, Housing, etc.', 'Brokers', 'Facebook or WhatsApp groups', 'Companies or colleges', 'Co-living brands or aggregators', 'Instagram', 'JustDial'] },
      { id: 'B2.2', core: 1, q: 'Do you pay brokers? How much per resident?', t: 'one', o: ['No', 'Under ₹1,000', '₹1,000–3,000', "Half a month's rent", "A month's rent"] },
      { id: 'B2.3', q: 'Monthly spend on getting residents (ads, listings, boards, brokers)', t: 'one', o: ['₹0', 'Under ₹2,000', '₹2,000–5,000', '₹5,000–10,000', 'Over ₹10,000'] },
      { id: 'B2.4', q: 'Paid listing apps you use now', t: 'all', o: ['NoBroker', 'Housing.com', 'MagicBricks', '99acres', 'JustDial', 'Google ads', 'None'], only: 'None', other: 1 },
      { id: 'B2.5', core: 1, q: 'How long does it take to fill an empty bed?', t: 'one', o: ['Under 3 days', 'About a week', 'About 2 weeks', 'About a month', 'Longer'] },
      { id: 'B2.6', q: 'Enquiries or visits needed for one resident', t: 'one', o: ['1–2', '3–5', '6–10', 'More than 10'] },
      { id: 'B2.7', q: 'How often do people pay a token and not turn up?', t: 'one', o: ['Often', 'Sometimes', 'Rarely', 'Never'] },
      { id: 'B2.8', q: 'Biggest problems filling beds', t: 'all', o: ['Time-wasting enquiries', 'Hard bargaining', 'Competition nearby', 'Bad online reviews', 'No-shows', 'Slow seasons', "Can't reach people outside Hyderabad"], other: 1 },
      { id: 'B2.9', core: 1, q: 'Would you list your PG on a free app?', t: 'one', o: YMN },
      { id: 'B2.10', q: 'What worries you about listing?', t: 'all', o: ['Commission', 'Pressure to cut rent', 'Unfair reviews', 'Fake bookings', 'Competitors seeing my data', 'Too much updating', 'Nothing'], only: 'Nothing', other: 1 },
      { id: 'B2.11', q: 'Would you like companies and colleges to send you residents?', t: 'one', o: YMN }
    ] },
    { id: 'B3', title: 'Bookings, visits and beds', qs: [
      { id: 'B3.1', q: 'How do you handle visits?', t: 'one', o: ['Walk in any time', 'By appointment', 'Only after a call'] },
      { id: 'B3.2', core: 1, q: 'How do you track which beds are free?', t: 'one', o: ['In my head', 'Register or notebook', 'Excel or Sheets', 'WhatsApp notes', 'Software or app'] },
      { id: 'B3.3', q: 'Have you double-booked a bed by mistake?', t: 'one', o: ['Never', 'Once', 'Several times'] },
      { id: 'B3.4', core: 1, q: 'Would you accept online bookings of an exact bed with a token?', t: 'one', o: YMN },
      { id: 'B3.5', q: 'Would you update bed availability in an app if it took under a minute a day?', t: 'one', o: YMN },
      { id: 'B3.6', core: 1, lead: "Move-in Guarantee: if a bed booked through Nivaz doesn't match the listing, the resident gets a full refund.", q: 'Would you list under this rule?', t: 'one', o: ['Yes', 'Yes, if Nivaz checks my listing first', 'No'] },
      { id: 'B3.7', q: 'Would you agree that the Nivaz price is never higher than your walk-in price?', t: 'one', o: YMN },
      { id: 'B3.8', lead: '"Nivaz remembers who found you": if someone visits or holds a bed through Nivaz and moves in within 60 days, it counts as a Nivaz booking.', q: 'How fair is that?', t: 'stars' },
      { id: 'B3.9', q: 'Would you hold a bed for someone moving in up to 15 days later?', t: 'one', o: ['Yes, with a token', 'Up to 7 days', 'No'] },
      { id: 'B3.10', q: 'Would you offer a paid trial night?', t: 'one', o: YMN }
    ] },
    { id: 'B4', title: 'New residents and records', qs: [
      { id: 'B4.1', q: 'Documents you collect', t: 'all', o: ['Aadhaar', 'PAN', 'Office or college ID', 'Photo', 'Police verification form', 'Parent contact', 'Offer letter', 'None'], only: 'None', other: 1 },
      { id: 'B4.2', q: 'Do you do police verification of residents?', t: 'one', o: ['Always', 'Sometimes', 'Never', 'Not sure how'] },
      { id: 'B4.3', core: 1, q: 'Where do you keep resident records?', t: 'one', o: ['Paper file or register', 'Photos on my phone', 'Excel', 'Software or app', 'Not kept'] },
      { id: 'B4.4', core: 1, q: 'Paperwork time for each new resident', t: 'one', o: ['Under 15 min', '15–30 min', '30–60 min', 'Over an hour'] },
      { id: 'B4.5', core: 1, q: 'How useful: the resident scans a QR at reception and fills in their own details and ID photo', t: 'stars' },
      { id: 'B4.6', q: 'How useful: a ready resident register to show the police', t: 'stars' },
      { id: 'B4.7', q: 'Do you give a written agreement or rules sheet?', t: 'one', o: ['Signed agreement', 'Rules sheet', 'Verbal only', 'Nothing'] },
      { id: 'B4.8', q: 'How useful: residents accept your rules in the app, with the date and time saved', t: 'stars' },
      { id: 'B4.9', q: "Has a resident left whom you couldn't trace later?", t: 'one', o: ['Never', 'Once', 'More than once'] },
      { id: 'B4.10', q: 'Would you prefer residents with a "Trusted resident" record?', t: 'one', o: ['Yes', "Doesn't matter"] }
    ] },
    { id: 'B5', title: 'Rent collection', qs: [
      { id: 'B5.1', core: 1, q: 'How do residents pay?', t: 'grid', scale: ['None', 'Some', 'Most'], items: ['Cash', 'UPI to personal number', 'Business UPI or QR', 'Bank transfer', 'Cheque', 'An app'] },
      { id: 'B5.2', q: 'When is rent due?', t: 'one', o: ['Same date for everyone', "Each resident's move-in date"], other: 1 },
      { id: 'B5.3', core: 1, q: 'Share of residents who pay late each month', t: 'one', o: ['Under 10%', '10–25%', '25–50%', 'Over 50%'] },
      { id: 'B5.4', q: 'How do you remind them?', t: 'all', o: ['Calls', 'WhatsApp', 'In person', 'Notice board', 'Staff remind them'], other: 1 },
      { id: 'B5.5', core: 1, q: 'Hours a month spent chasing rent', t: 'one', o: ['Under 2', '2–5', '5–10', 'Over 10'] },
      { id: 'B5.6', q: 'Late fee', t: 'one', o: ['None', 'Fixed amount', 'Per day', "Have one but don't charge it"] },
      { id: 'B5.7', q: 'Money lost to residents who left without paying (last 12 months)', t: 'one', o: ['None', 'Under ₹10,000', '₹10,000–50,000', 'Over ₹50,000'] },
      { id: 'B5.8', q: 'Do you give rent receipts?', t: 'one', o: ['Always', 'When asked', 'Never'] },
      { id: 'B5.9', core: 1, q: 'For each tool: must have, nice to have, or don\'t need?', t: 'grid', scale: MUST, items: ['Automatic reminders', 'UPI AutoPay', 'Automatic late fees', 'Automatic receipts', 'Who-has-paid list', 'Electricity bill split'] },
      { id: 'B5.10', core: 1, lead: 'A payment company (like Razorpay) collects rent and sends it to your bank the next day. It asks for your bank account and PAN once.', q: 'Would you take payments this way?', t: 'one', o: ['Yes', 'Need to know more', 'No, direct UPI only'] },
      { id: 'B5.11', q: 'How fast must the money reach your bank?', t: 'one', o: ['Same day', 'Next day', 'Within a week'] },
      { id: 'B5.12', q: 'Would you accept card payments if the resident pays the extra fee?', t: 'one', o: ['Yes', 'No'] }
    ] },
    { id: 'B6', title: 'Deposits and move-outs', qs: [
      { id: 'B6.1', q: 'When do you usually refund deposits?', t: 'one', o: ['Same day', 'Within a week', '2–4 weeks', 'Longer', "Adjusted in the last month's rent"] },
      { id: 'B6.2', q: 'Common reasons for cutting deposits', t: 'all', o: ['Damage', 'Cleaning', 'Notice not served', 'Unpaid bills', 'Lost keys', 'None'], only: 'None', other: 1 },
      { id: 'B6.3', q: 'How often are there arguments over deposits?', t: 'one', o: ['Often', 'Sometimes', 'Rarely'] },
      { id: 'B6.4', q: 'Do you use a move-in and move-out checklist?', t: 'one', o: ['Yes, with photos', 'Yes, written', 'No'] },
      { id: 'B6.5', core: 1, lead: 'Deposit Promise: refund within 7 days of move-out, with your refund record shown on your listing.', q: 'Would you agree to this?', t: 'one', o: ['Yes', 'With conditions', 'No'] },
      { id: 'B6.6', q: 'Would you take a smaller deposit from residents with a "Trusted resident" record?', t: 'one', o: YMN },
      { id: 'B6.7', q: 'How often do residents leave without serving notice?', t: 'one', o: ['Often', 'Sometimes', 'Rarely'] },
      { id: 'B6.8', lead: "Swap: a resident who leaves early doesn't pay the notice penalty if their bed is booked through Nivaz.", q: 'Would you agree to this?', t: 'one', o: YMN }
    ] },
    { id: 'B7', title: 'Daily running', qs: [
      { id: 'B7.1', q: 'Staff you have', t: 'all', o: ['Cook', 'Cleaner', 'Warden', 'Security guard', 'Manager', 'Maintenance person', 'None'], only: 'None', other: 1 },
      { id: 'B7.2', q: 'How do you give staff instructions and check their work?', t: 'one', o: ['In person', 'WhatsApp', 'Phone calls', 'Register', 'Not really tracked'] },
      { id: 'B7.3', q: 'How do residents send complaints?', t: 'one', o: ['In person', 'Calls', 'WhatsApp', 'Complaint book'] },
      { id: 'B7.4', q: 'Average time to fix a complaint', t: 'one', o: ['Same day', '1–2 days', '3–7 days', 'Longer'] },
      { id: 'B7.5', q: 'Most common complaints', t: 'all', o: ['Food', 'Water', 'Wi-Fi', 'Cleaning', 'Plumbing', 'Electrical', 'Noise', 'Roommates', 'Pests'], other: 1 },
      { id: 'B7.6', core: 1, q: 'How much food is wasted?', t: 'one', o: ['Very little', 'Some', 'A lot'], when: a => a['B1.10'] !== 'No food' },
      { id: 'B7.7', q: 'If residents marked meal skips in advance, how much could you save a month?', t: 'one', o: ['Nothing', 'Under ₹2,000', '₹2,000–5,000', '₹5,000–10,000', 'Over ₹10,000'], when: a => a['B1.10'] !== 'No food' },
      { id: 'B7.8', q: 'How often does your menu change?', t: 'one', o: ['Fixed weekly menu', 'Changes often', 'No fixed menu'], when: a => a['B1.10'] !== 'No food' },
      { id: 'B7.9', q: 'How do you send notices?', t: 'all', o: ['WhatsApp group', 'Notice board', 'Word of mouth'], other: 1 },
      { id: 'B7.10', q: 'Your rules for late entry, nights out and guests', t: 'all', o: ['Late entry needs approval', 'Night out needs approval', 'Day guests allowed', 'No guests', 'No rules'], only: 'No rules' },
      { id: 'B7.11', q: 'How do you charge electricity?', t: 'one', o: ['Included in rent', 'Meter per room', 'Split equally', 'AC rooms only'] },
      { id: 'B7.12', q: 'How useful: one app for complaints, food counts, notices and requests', t: 'stars' }
    ] },
    { id: 'B8', title: 'Costs and profit', qs: [
      { id: 'B8.1', q: 'Your biggest monthly costs', t: 'top3', o: ['Building rent or loan EMI', 'Food and groceries', 'Staff salaries', 'Electricity', 'Water or tankers', 'Wi-Fi', 'Repairs', 'Brokers and ads', 'Taxes and licences', 'Laundry'] },
      { id: 'B8.2', core: 1, q: 'Do you know your monthly profit for each property?', t: 'one', o: ['Exactly', 'Roughly', 'Not really'] },
      { id: 'B8.3', core: 1, q: 'How do you track expenses?', t: 'one', o: ['Notebook', 'Excel or Sheets', 'Accountant', 'Software or app', 'Not tracked'] },
      { id: 'B8.4', q: 'How useful: profit per property each month, with a 6-month chart', t: 'stars' },
      { id: 'B8.5', q: 'Would monthly statements for your accountant (income tax) help?', t: 'one', o: ['Yes', 'No'] },
      { id: 'B8.6', lead: 'Optional. Your answer stays private.', q: 'Registrations your PG has', t: 'all', o: ['GHMC trade licence', 'Fire NOC', 'Food licence (FSSAI)', 'GST', 'Police intimation', 'None', 'Prefer not to say'], only: 'Prefer not to say' },
      { id: 'B8.7', q: 'Would reminders before licence renewals help?', t: 'one', o: ['Yes', 'No'] }
    ] },
    { id: 'B9', title: 'Phones and software', qs: [
      { id: 'B9.1', q: 'Your phone', t: 'one', o: ['Android', 'iPhone', 'Basic phone'] },
      { id: 'B9.2', q: 'Who does the phone and computer work for the PG?', t: 'one', o: ['Me', 'A family member', 'Manager', 'Staff'] },
      { id: 'B9.3', q: 'Apps you use for the business now', t: 'all', o: ['WhatsApp', 'WhatsApp Business', 'Excel or Google Sheets', 'Tally', 'A PG management app', 'Listing apps', 'None'], only: 'None', other: 1 },
      { id: 'B9.4', q: 'Have you tried a PG management app?', t: 'one', o: ['Using one now', 'Tried and stopped', 'Never'] },
      { id: 'B9.5', q: 'Why did you stop?', t: 'all', o: ['Too complicated', 'Too expensive', "Residents didn't use it", "Staff couldn't use it", 'Missing features', 'Language'], other: 1, when: a => a['B9.4'] === 'Tried and stopped' },
      { id: 'B9.6', q: 'How comfortable are you with apps?', t: 'stars' },
      { id: 'B9.7', q: 'Language you prefer', t: 'one', o: ['English', 'Telugu', 'Hindi'], other: 1 },
      { id: 'B9.8', q: 'Do you use a laptop or computer for the business?', t: 'one', o: ['Daily', 'Sometimes', 'Never'] }
    ] },
    { id: 'B10', title: 'Reviews, Nivaz Stars and verification', qs: [
      { id: 'B10.1', core: 1, q: 'How do you feel about public ratings only from real residents?', t: 'stars', lo: 'Against', hi: 'Welcome' },
      { id: 'B10.2', q: 'Your concerns about ratings', t: 'all', o: ['Unfair angry reviews', 'Competitors', 'Ex-residents with grudges', 'Nothing'], only: 'Nothing', other: 1 },
      { id: 'B10.3', q: 'Would you reply to reviews?', t: 'one', o: ['Yes', 'Sometimes', 'No'] },
      { id: 'B10.4', core: 1, lead: 'Nivaz Stars: ★ to ★★★★★ based on your facilities.', q: 'Would you like a Nivaz Stars level for your PG?', t: 'one', o: YMN },
      { id: 'B10.5', q: 'Would you allow a Nivaz visit (photos, checklist) for a "Checked by Nivaz" badge?', t: 'one', o: YMN },
      { id: 'B10.6', q: 'Would you pay for that visit?', t: 'one', o: ['Only if free', 'Up to ₹500', 'Up to ₹1,000', 'Up to ₹2,000'] },
      { id: 'B10.7', q: 'Would you add facilities to reach a higher star level?', t: 'one', o: YMN }
    ] },
    { id: 'B11', title: 'Features: what matters to you', qs: [
      { id: 'B11.1', core: 1, q: 'For each feature: must have, nice to have, or don\'t need?', t: 'grid', scale: MUST, items: featureNames(O_FEATURES) },
      { id: 'B11.2', core: 1, q: 'Your top 3 features', t: 'top3', o: (a, mode) => featureNames(O_FEATURES)(mode) },
      { id: 'B11.3', q: 'Anything missing?', t: 'text' },
      { id: 'B11.4', q: 'What would make you stop using an app like this?', t: 'all', o: ['Too much data entry', "Residents won't use it", "Staff can't use it", 'Costs too much', 'Nothing'], only: 'Nothing', other: 1 }
    ] },
    { id: 'B12', title: "Pricing: what you'd pay", lead: 'These are ideas; nothing is decided.', qs: [
      { id: 'B12.1', core: 1, q: 'Which way of paying would you prefer?', t: 'one', o: ['Free basic plan + paid extras', 'Fixed monthly fee', 'Fee only when the app brings a resident', 'Per bed per month', 'One-time setup fee'] },
      { id: 'B12.2', core: 1, q: 'A fair fee for each resident Nivaz brings you', t: 'one', o: ['Nothing', '₹499', '₹999', '₹1,499', '5% of first month', '10% of first month', "15 days' rent"] },
      { id: 'B12.3', core: 1, q: 'A fair monthly fee for the full owner tools (rent, complaints, food, profit, staff)', t: 'one', o: ['Nothing', 'Up to ₹499', '₹500–999', '₹1,000–1,999', '₹2,000–2,999', '₹3,000 or more'] },
      { id: 'B12.4', q: 'Or per bed per month', t: 'one', o: ['₹10', '₹20', '₹30', '₹50', "Wouldn't pay per bed"] },
      { id: 'B12.5', lead: 'Think about the full owner tools: rent, complaints, food, profit and staff.', q: "At what monthly price would they seem so cheap you'd doubt them?", t: 'num', unit: '₹' },
      { id: 'B12.6', q: 'At what monthly price would they be a good deal?', t: 'num', unit: '₹' },
      { id: 'B12.7', q: 'At what monthly price would they be getting expensive, but still worth thinking about?', t: 'num', unit: '₹' },
      { id: 'B12.8', q: 'At what monthly price would they be too expensive to consider?', t: 'num', unit: '₹' },
      { id: 'B12.9', q: 'Would you pay to appear at the top of search in busy months?', t: 'one', o: ['No', 'Up to ₹500 a week', '₹500–1,000 a week', 'Over ₹1,000 a week'] },
      { id: 'B12.10', q: "Free trial you'd need before paying", t: 'one', o: ['1 month', '3 months', '6 months', "Only if it's free forever"] },
      { id: 'B12.11', q: 'Who should pay the extra fee when a resident pays by card?', t: 'one', o: ['Resident', 'Me', 'Split'] },
      { id: 'B12.12', q: 'Would you like Nivaz to pay your warden ₹50 for each resident added in the app?', t: 'one', o: ['Yes', "Doesn't matter", 'No'] },
      { id: 'B12.13', q: 'What would make you switch from how you work today?', t: 'text' }
    ] },
    { id: 'B13', title: 'Wrap-up', qs: [
      { id: 'B13.1', core: 1, q: 'How likely are you to try Nivaz?', t: 'nps' },
      { id: 'B13.2', core: 1, q: 'The biggest problem you want solved', t: 'text' },
      { id: 'B13.3', core: 1, q: 'Would you be one of the first PGs on Nivaz (free during the pilot)?', t: 'one', o: ['Yes', 'Maybe', 'No'], ask: { Yes: ['phone'] }, flag: 'pilot' },
      { id: 'B13.4', q: 'Can we visit to take photos and a 360° tour?', t: 'one', o: ['Yes', 'Later', 'No'] },
      { id: 'B13.5', q: 'Would you ask your residents to join the app?', t: 'one', o: ['Yes, all of them', 'Some', 'No'] },
      { id: 'B13.6', q: 'Would you, your staff or residents test the app before launch?', t: 'one', o: ['Yes', 'No'], ask: { Yes: ['gmail'] }, flag: 'testing' },
      { id: 'B13.7', q: 'Other owners we should talk to? (optional)', t: 'text', toContact: 'note' }
    ] }
  ];

  window.NIVAZ_SURVEY = {
    version: 1,
    resident: { title: 'Residents and PG seekers', minutes: { core: 15, full: 40 }, sections: resident },
    owner: { title: 'PG owners and managers', minutes: { core: 20, full: 45 }, sections: owner }
  };
})();

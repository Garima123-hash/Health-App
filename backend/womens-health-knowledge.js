const knowledge = [
  {
    id: 'pcos-overview',
    title: 'PCOS / PCOD overview',
    url: 'https://womenshealth.gov/a-z-topics/polycystic-ovary-syndrome',
    terms: ['pcos', 'pcod', 'ovary', 'ovarian', 'hormone', 'period', 'cycle'],
    text: 'PCOS is a hormone-related condition with symptoms that vary between people. Irregular periods, acne, extra facial or body hair, and scalp hair thinning can occur, but these symptoms can also have other causes. PCOD is a term commonly used for PCOS in some regions.'
  },
  {
    id: 'pcos-assessment',
    title: 'How clinicians assess PCOS',
    url: 'https://womenshealth.gov/a-z-topics/polycystic-ovary-syndrome',
    terms: ['diagnose', 'diagnosis', 'symptom', 'symptoms', 'test', 'history', 'report', 'ultrasound', 'blood'],
    text: 'There is no single test that confirms PCOS. A clinician considers medical history, symptoms, examination, and sometimes blood tests or ultrasound, and may check for other causes. A symptom list, mood log, or uploaded report by itself cannot diagnose PCOS.'
  },
  {
    id: 'pcos-care',
    title: 'Discussing care with a clinician',
    url: 'https://womenshealth.gov/a-z-topics/polycystic-ovary-syndrome',
    terms: ['care', 'treatment', 'doctor', 'clinician', 'medicine', 'medication', 'fertility', 'appointment'],
    text: 'PCOS care is individualized. A clinician can discuss options based on symptoms, health history, personal goals, and future pregnancy plans. Do not start, stop, or change medicines or supplements based on this guide.'
  },
  {
    id: 'balanced-eating',
    title: 'General healthy-eating principles',
    url: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
    terms: ['eat', 'food', 'diet', 'meal', 'nutrition', 'snack', 'weight', 'sugar'],
    text: 'The World Health Organization describes healthy eating using adequacy, balance, moderation, and diversity. A varied pattern can include vegetables and fruits, pulses such as beans or lentils, and whole grains where available. There is no single food or meal plan that diagnoses or cures PCOS; adapt food choices to allergies, culture, access, and advice from a qualified clinician or dietitian.'
  },
  {
    id: 'mood-reflection',
    title: 'Using mood check-ins',
    url: 'https://womenshealth.gov/a-z-topics/polycystic-ovary-syndrome',
    terms: ['mood', 'stress', 'sleep', 'energy', 'anxiety', 'sad', 'low', 'mental'],
    text: 'Mood check-ins can help you notice what you want to discuss with a trusted person or clinician. They are not a mental-health assessment and cannot determine the cause of a mood change. Seek professional support if mood concerns persist, worsen, or interfere with daily life.'
  },
  {
    id: 'pregnancy-overview',
    title: 'Pregnancy and antenatal care',
    url: 'https://www.who.int/health-topics/pregnancy',
    terms: ['pregnancy', 'pregnant', 'antenatal', 'prenatal', 'maternal', 'obstetric', 'midwife'],
    text: 'Pregnancy care is individual. Arrange regular antenatal care with a qualified clinician or midwife, and discuss medicines, supplements, vaccinations, symptoms, and questions with them. This guide cannot assess a pregnancy or replace urgent or routine medical care.'
  },
  {
    id: 'pregnancy-warning-signs',
    title: 'When to contact a pregnancy-care professional',
    url: 'https://www.who.int/health-topics/pregnancy',
    terms: ['pregnancy', 'pregnant', 'bleeding', 'pain', 'urgent', 'emergency', 'warning', 'symptom'],
    text: 'New, severe, or worrying symptoms during pregnancy should be discussed promptly with a qualified pregnancy-care professional. If there is heavy bleeding, severe pain, fainting, trouble breathing, or another emergency, contact local emergency services or seek urgent care.'
  }
];

const funFacts = [
  'PCOS symptoms can differ widely; two people with the same diagnosis may have different experiences.',
  'The name PCOS can be confusing: a clinician considers the whole health picture, not just an ultrasound image.',
  'Keeping a simple record of period dates and symptoms can help you describe changes at a medical appointment.'
];

const stopWords = new Set('about after again also and are any can could did does for from had has have how into its just like may more most not of on our out should some than that the their them then there these this through what when where which who why with your'.split(' '));

function tokens(value) {
  return new Set(String(value || '').toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(word => !stopWords.has(word)) || []);
}

function retrieveKnowledge(question, documents = []) {
  const query = tokens(question);
  const uploadedKnowledge = documents.flatMap(document => {
    const sentences = String(document.text || '').match(/[^.!?]+[.!?]?/g) || [];
    return sentences
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 35)
      .map((text, index) => ({
        id: `admin-doc-${document.id}-${index}`,
        title: document.title,
        url: '',
        text
      }));
  });
  return [...knowledge, ...uploadedKnowledge]
    .map(item => {
      const terms = new Set([...tokens(item.text), ...(item.terms || [])]);
      const matches = [...query].filter(word => terms.has(word)).length;
      return { ...item, matches };
    })
    .filter(item => item.matches > 0)
    .sort((a, b) => b.matches - a.matches || a.id.localeCompare(b.id))
    .slice(0, 5)
    .map(({ id, title, url, text }) => ({ id, title, url, text }));
}

module.exports = { funFacts, retrieveKnowledge };

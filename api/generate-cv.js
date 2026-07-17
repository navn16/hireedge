const Anthropic = require('@anthropic-ai/sdk');
const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, LevelFormat, TabStopType, TabStopPosition } = require('docx');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { cvText, jobDescription, userName } = req.body;

    if (!cvText || !jobDescription) {
      return res.status(400).json({ error: 'Missing CV text or job description' });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `You are an expert CV writer and ATS specialist. Rewrite and tailor the following CV to match the job description provided. Return ONLY a raw JSON object — no markdown, no backticks, no explanation.

ORIGINAL CV:
${cvText}

JOB DESCRIPTION:
${jobDescription}

Return this exact JSON structure:
{
  "name": "<full name from CV>",
  "contact": "<phone | email | location on one line>",
  "summary": "<3-4 sentence ATS-optimised professional summary tailored to this specific job. Use keywords from the job description.>",
  "experience": [
    {
      "company": "<company name>",
      "location": "<city, country>",
      "title": "<job title>",
      "dates": "<start date – end date>",
      "bullets": ["<rewritten bullet with specific achievement and number>", "<bullet 2>", "<bullet 3>", "<bullet 4>"]
    }
  ],
  "education": [
    {
      "degree": "<degree name>",
      "school": "<school name>",
      "year": "<graduation year>"
    }
  ],
  "skills": ["<skill 1>", "<skill 2>", "<skill 3>", "<up to 12 skills including missing keywords from job description>"],
  "certifications": ["<cert 1>", "<cert 2>"]
}

Rules:
- Rewrite ALL bullet points to be stronger, more quantified, and include keywords from the job description
- Add missing keywords from the job description naturally throughout
- Keep all real experience, dates, companies and education — do not fabricate
- Make the summary specifically target this job
- Skills should include both existing skills AND missing keywords from job description`;

    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const raw = response.content[0].text;
    let cvData;
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      cvData = JSON.parse(clean);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse CV data' });
    }

    const doc = buildDocx(cvData);
    const buffer = await Packer.toBuffer(doc);
    const base64 = buffer.toString('base64');

    return res.status(200).json({ docx: base64, name: cvData.name });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
};

function buildDocx(cv) {
  const children = [];

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [new TextRun({ text: cv.name || 'Your Name', bold: true, size: 28, font: 'Calibri' })]
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [new TextRun({ text: cv.contact || '', size: 20, font: 'Calibri', color: '444444' })]
  }));

  if (cv.summary) {
    children.push(sectionHeader('PROFESSIONAL SUMMARY'));
    children.push(new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: cv.summary, size: 20, font: 'Calibri' })]
    }));
  }

  if (cv.experience && cv.experience.length > 0) {
    children.push(sectionHeader('EXPERIENCE'));
    cv.experience.forEach(job => {
      children.push(new Paragraph({
        spacing: { before: 120, after: 0 },
        tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
        children: [
          new TextRun({ text: job.company || '', bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: '\t', size: 20 }),
          new TextRun({ text: job.location || '', size: 20, font: 'Calibri', color: '555555' })
        ]
      }));
      children.push(new Paragraph({
        spacing: { after: 80 },
        tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
        children: [
          new TextRun({ text: job.title || '', italics: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: '\t', size: 20 }),
          new TextRun({ text: job.dates || '', size: 20, font: 'Calibri', color: '555555' })
        ]
      }));
      (job.bullets || []).forEach(bullet => {
        children.push(new Paragraph({
          spacing: { after: 60 },
          numbering: { reference: 'bullets', level: 0 },
          children: [new TextRun({ text: bullet, size: 20, font: 'Calibri' })]
        }));
      });
      children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
    });
  }

  if (cv.education && cv.education.length > 0) {
    children.push(sectionHeader('EDUCATION'));
    cv.education.forEach(edu => {
      children.push(new Paragraph({
        spacing: { after: 0 },
        tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
        children: [
          new TextRun({ text: edu.degree || '', bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: '\t', size: 20 }),
          new TextRun({ text: edu.year || '', size: 20, font: 'Calibri', color: '555555' })
        ]
      }));
      children.push(new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: edu.school || '', size: 20, font: 'Calibri', color: '444444' })]
      }));
    });
  }

  if (cv.skills && cv.skills.length > 0) {
    children.push(sectionHeader('SKILLS'));
    children.push(new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: 'Skills: ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: cv.skills.join(', '), size: 20, font: 'Calibri' })
      ]
    }));
  }

  if (cv.certifications && cv.certifications.length > 0) {
    children.push(new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: 'Certifications: ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: cv.certifications.join(', '), size: 20, font: 'Calibri' })
      ]
    }));
  }

  return new Document({
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      }]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
        }
      },
      children
    }]
  });
}

function sectionHeader(title) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1c2b4a', space: 4 } },
    children: [new TextRun({ text: title, bold: true, size: 22, font: 'Calibri', color: '1c2b4a' })]
  });
}

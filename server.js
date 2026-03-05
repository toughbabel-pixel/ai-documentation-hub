require('dotenv').config();
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database(path.join(__dirname, 'hub.db'));

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

const runExecute = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });

const bootstrapDatabase = () => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS prompt_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS workflows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      steps TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS experiments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      hypothesis TEXT,
      results TEXT,
      status TEXT DEFAULT 'planned',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.get('SELECT COUNT(*) AS count FROM prompt_library', (err, row) => {
      if (!err && row.count === 0) {
        db.run(
          'INSERT INTO prompt_library (title, content, tags) VALUES (?, ?, ?)',
          [
            'Summarize Technical Docs',
            'Summarize the following technical document into key points and actionable steps: {{document}}',
            'summary,documentation'
          ]
        );
      }
    });

    db.get('SELECT COUNT(*) AS count FROM workflows', (err, row) => {
      if (!err && row.count === 0) {
        db.run(
          'INSERT INTO workflows (name, description, steps) VALUES (?, ?, ?)',
          [
            'Content Update Workflow',
            'Standard workflow for updating internal docs with AI support.',
            JSON.stringify([
              'Collect source updates',
              'Run AI summary + validation',
              'Publish reviewed content'
            ])
          ]
        );
      }
    });

    db.get('SELECT COUNT(*) AS count FROM tools', (err, row) => {
      if (!err && row.count === 0) {
        db.run(
          'INSERT INTO tools (name, category, description, url) VALUES (?, ?, ?, ?)',
          [
            'OpenAI API',
            'LLM Platform',
            'Used for prompt refinement, workflow generation, and document summarization.',
            'https://platform.openai.com'
          ]
        );
      }
    });

    db.get('SELECT COUNT(*) AS count FROM experiments', (err, row) => {
      if (!err && row.count === 0) {
        db.run(
          'INSERT INTO experiments (title, hypothesis, results, status) VALUES (?, ?, ?, ?)',
          [
            'Prompt Compression Test',
            'Shorter prompts can preserve quality for summaries.',
            'Early tests show 18% token reduction with similar quality.',
            'completed'
          ]
        );
      }
    });
  });
};

bootstrapDatabase();

const handleList = (table) => async (_req, res) => {
  try {
    const rows = await runQuery(`SELECT * FROM ${table} ORDER BY created_at DESC`);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

app.get('/api/prompts', handleList('prompt_library'));
app.get('/api/workflows', handleList('workflows'));
app.get('/api/tools', handleList('tools'));
app.get('/api/experiments', handleList('experiments'));

app.post('/api/prompts', async (req, res) => {
  const { title, content, tags = '' } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required' });
  }

  try {
    const result = await runExecute(
      'INSERT INTO prompt_library (title, content, tags) VALUES (?, ?, ?)',
      [title, content, tags]
    );
    res.status(201).json({ id: result.id, title, content, tags });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/workflows', async (req, res) => {
  const { name, description, steps } = req.body;
  if (!name || !description || !Array.isArray(steps)) {
    return res
      .status(400)
      .json({ error: 'name, description and steps[] are required' });
  }

  try {
    const result = await runExecute(
      'INSERT INTO workflows (name, description, steps) VALUES (?, ?, ?)',
      [name, description, JSON.stringify(steps)]
    );
    res.status(201).json({ id: result.id, name, description, steps });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tools', async (req, res) => {
  const { name, category, description, url = '' } = req.body;
  if (!name || !category || !description) {
    return res.status(400).json({ error: 'name, category and description are required' });
  }

  try {
    const result = await runExecute(
      'INSERT INTO tools (name, category, description, url) VALUES (?, ?, ?, ?)',
      [name, category, description, url]
    );
    res.status(201).json({ id: result.id, name, category, description, url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/experiments', async (req, res) => {
  const { title, hypothesis = '', results = '', status = 'planned' } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const result = await runExecute(
      'INSERT INTO experiments (title, hypothesis, results, status) VALUES (?, ?, ?, ?)',
      [title, hypothesis, results, status]
    );
    res.status(201).json({ id: result.id, title, hypothesis, results, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/improve-prompt', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });
  if (!openai) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY is missing. Add it to your environment to use AI features.'
    });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            'You improve prompts for clarity, constraints, and desired output formatting.'
        },
        {
          role: 'user',
          content: `Improve the following prompt:\n\n${prompt}`
        }
      ]
    });

    res.json({ output: completion.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/generate-workflow', async (req, res) => {
  const { goal, context = '' } = req.body;
  if (!goal) return res.status(400).json({ error: 'goal is required' });
  if (!openai) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY is missing. Add it to your environment to use AI features.'
    });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'Generate concise, practical workflows with numbered steps and optional validation checks.'
        },
        {
          role: 'user',
          content: `Create a workflow for this goal: ${goal}. Additional context: ${context}`
        }
      ]
    });

    res.json({ output: completion.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/summarize-docs', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (!openai) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY is missing. Add it to your environment to use AI features.'
    });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'Summarize documentation with sections: Summary, Key Decisions, Risks, and Next Actions.'
        },
        {
          role: 'user',
          content: text
        }
      ]
    });

    res.json({ output: completion.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`AI Documentation Hub running at http://localhost:${PORT}`);
});

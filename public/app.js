const sections = document.querySelectorAll('.content-section');
const navButtons = document.querySelectorAll('.nav-btn');

const switchSection = (id) => {
  sections.forEach((section) => {
    section.classList.toggle('hidden', section.id !== id);
  });

  navButtons.forEach((button) => {
    const active = button.dataset.section === id;
    button.classList.toggle('bg-slate-700', active);
  });
};

navButtons.forEach((button) => {
  button.addEventListener('click', () => switchSection(button.dataset.section));
});

const fetchJSON = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
};

const renderCard = (title, body, meta = '') => `
  <article class="border rounded p-3 bg-slate-50">
    <h4 class="font-semibold">${title}</h4>
    <p class="text-sm text-slate-700 mt-1">${body}</p>
    ${meta ? `<p class="text-xs text-slate-500 mt-2">${meta}</p>` : ''}
  </article>
`;

const loadPrompts = async () => {
  const prompts = await fetchJSON('/api/prompts');
  document.getElementById('prompt-list').innerHTML = prompts
    .map((item) => renderCard(item.title, item.content, item.tags || 'no tags'))
    .join('');
};

const loadWorkflows = async () => {
  const workflows = await fetchJSON('/api/workflows');
  document.getElementById('workflow-list').innerHTML = workflows
    .map((item) => {
      const steps = JSON.parse(item.steps || '[]').join(' → ');
      return renderCard(item.name, item.description, steps);
    })
    .join('');
};

const loadTools = async () => {
  const tools = await fetchJSON('/api/tools');
  document.getElementById('tool-list').innerHTML = tools
    .map((item) =>
      renderCard(
        `${item.name} (${item.category})`,
        item.description,
        item.url ? `<a class="text-blue-600" href="${item.url}" target="_blank">${item.url}</a>` : ''
      )
    )
    .join('');
};

const loadExperiments = async () => {
  const experiments = await fetchJSON('/api/experiments');
  document.getElementById('experiment-list').innerHTML = experiments
    .map((item) => renderCard(item.title, item.hypothesis || '-', `Status: ${item.status} | ${item.results || ''}`))
    .join('');
};

document.getElementById('prompt-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const payload = Object.fromEntries(formData.entries());

  try {
    await fetchJSON('/api/prompts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    event.target.reset();
    await loadPrompts();
  } catch (error) {
    alert(error.message);
  }
});

document.querySelectorAll('.assistant-form').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      const data = await fetchJSON(form.dataset.endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      document.getElementById('assistant-output').textContent = data.output;
    } catch (error) {
      document.getElementById('assistant-output').textContent = error.message;
    }
  });
});

const initialize = async () => {
  try {
    await Promise.all([loadPrompts(), loadWorkflows(), loadTools(), loadExperiments()]);
  } catch (error) {
    console.error(error);
  }
};

initialize();

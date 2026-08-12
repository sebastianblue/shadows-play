(() => {
  "use strict";

  const form = document.querySelector("#interest-form");
  const steps = [...document.querySelectorAll(".form-step")];
  const progressBar = document.querySelector("#progress-bar");
  const stepLabel = document.querySelector("#step-label");
  const stepName = document.querySelector("#step-name");
  const roleInputs = [...document.querySelectorAll('input[name="roles"]')];
  const primaryRole = document.querySelector("#primary-role");
  const availabilityCalendar = document.querySelector("#availability-calendar");
  const roleError = document.querySelector("#role-error");
  const availabilityError = document.querySelector("#availability-error");
  const submitError = document.querySelector("#submit-error");
  const submitButton = document.querySelector("#submit-button");
  const reviewCard = document.querySelector("#review-card");
  const successPanel = document.querySelector("#success-panel");
  const progressWrap = document.querySelector(".progress-wrap");
  const submitAnother = document.querySelector("#submit-another");

  const ROLE_LABELS = {
    producers: "Producers",
    assistant_director: "Assistant director",
    stage_manager: "Stage manager",
    assistant_stage_manager: "Assistant stage manager",
    technical_director: "Technical director",
    production_assistant: "Production assistant",
    lighting_designer: "Lighting designer",
    sound_designer: "Sound designer",
    set_designer: "Set designer",
    props_designer: "Props designer",
    costume_designer: "Costume designer",
    projections_designer: "Projections / multimedia designer",
    intimacy_coordinator: "Intimacy coordination",
    puppetry_coordinator: "Puppetry coordination / choreography",
    puppet_construction: "Puppet construction",
    scenic_builder: "Scenic builder",
    qlab_operator: "QLab operation",
    lightboard_operator: "Light-board operation",
    photography_marketing: "Photography & marketing",
    graphic_design: "Graphic design",
    house_management: "House management"
  };

  const BRANCHES = {
    producers: ["leadership"],
    assistant_director: ["leadership", "practice"],
    stage_manager: ["leadership"],
    assistant_stage_manager: ["leadership"],
    technical_director: ["leadership", "design", "fabrication"],
    production_assistant: ["leadership"],
    lighting_designer: ["design"],
    sound_designer: ["design"],
    set_designer: ["design", "fabrication"],
    props_designer: ["design", "fabrication"],
    costume_designer: ["design", "fabrication"],
    projections_designer: ["design"],
    intimacy_coordinator: ["practice"],
    puppetry_coordinator: ["practice"],
    puppet_construction: ["practice", "fabrication"],
    scenic_builder: ["fabrication"],
    qlab_operator: ["operations"],
    lightboard_operator: ["operations"],
    photography_marketing: ["communications"],
    graphic_design: ["communications"],
    house_management: ["audience"]
  };

  const EVENTS = [
    { id: "kickoff", date: "Sunday, September 27", title: "Production kickoff" },
    { id: "concepts", date: "Sunday, October 18", title: "Design concepts due / production check-in" },
    { id: "first_run", date: "Sunday, October 25", title: "First full run" },
    { id: "design_run", date: "Sunday, November 8", title: "Design run" },
    { id: "onsite_run", date: "Sunday, November 15", title: "Full on-site run" },
    { id: "load_in", date: "Monday, November 16", title: "Load-in and system setup" },
    { id: "cue_to_cue", date: "Tuesday, November 17", title: "Cue-to-cue" },
    { id: "tech_run", date: "Wednesday, November 18", title: "Full technical run" },
    { id: "dress", date: "Thursday, November 19", title: "Dress rehearsal / invited preview" },
    { id: "opening", date: "Friday, November 20", title: "Opening performance" },
    { id: "saturday", date: "Saturday, November 21", title: "Performance" },
    { id: "final_strike", date: "Sunday, November 22", title: "Final performance and strike" }
  ];

  const R = "required";
  const P = "preferred";
  const D = "deadline";

  const ROLE_EVENT_RULES = {
    producers: { kickoff:R, concepts:R, first_run:R, design_run:R, onsite_run:R, load_in:R, cue_to_cue:P, tech_run:R, dress:R, opening:R, saturday:R, final_strike:R },
    assistant_director: { kickoff:R, concepts:P, first_run:R, design_run:R, onsite_run:R, load_in:P, cue_to_cue:R, tech_run:R, dress:R, opening:R, saturday:R, final_strike:R },
    stage_manager: { kickoff:R, first_run:R, design_run:R, onsite_run:R, load_in:R, cue_to_cue:R, tech_run:R, dress:R, opening:R, saturday:R, final_strike:R },
    assistant_stage_manager: { first_run:P, design_run:R, onsite_run:R, load_in:R, cue_to_cue:R, tech_run:R, dress:R, opening:R, saturday:R, final_strike:R },
    technical_director: { kickoff:R, concepts:R, first_run:P, design_run:R, onsite_run:R, load_in:R, cue_to_cue:R, tech_run:R, dress:R, opening:P, final_strike:R },
    production_assistant: { kickoff:P, first_run:P, design_run:P, onsite_run:P, load_in:P, cue_to_cue:P, tech_run:P, dress:P, opening:P, saturday:P, final_strike:P },
    lighting_designer: { kickoff:R, concepts:R, first_run:P, design_run:R, onsite_run:R, load_in:R, cue_to_cue:R, tech_run:R, dress:R, opening:R, saturday:P, final_strike:P },
    sound_designer: { kickoff:R, concepts:R, first_run:R, design_run:R, onsite_run:R, load_in:R, cue_to_cue:R, tech_run:R, dress:R, opening:R, saturday:P, final_strike:P },
    set_designer: { kickoff:R, concepts:R, first_run:P, design_run:R, onsite_run:R, load_in:R, cue_to_cue:P, tech_run:P, dress:P, final_strike:R },
    props_designer: { kickoff:P, concepts:R, first_run:R, design_run:R, onsite_run:R, load_in:R, dress:R, opening:R, final_strike:P },
    costume_designer: { kickoff:P, concepts:R, first_run:R, design_run:R, onsite_run:R, load_in:P, dress:R, opening:R, final_strike:P },
    projections_designer: { kickoff:R, concepts:R, first_run:P, design_run:R, onsite_run:R, load_in:R, cue_to_cue:R, tech_run:R, dress:R, opening:R, saturday:P, final_strike:P },
    intimacy_coordinator: { kickoff:P, first_run:P, design_run:R, onsite_run:P, dress:P },
    puppetry_coordinator: { kickoff:R, concepts:R, first_run:R, design_run:R, onsite_run:R, load_in:P, cue_to_cue:R, tech_run:R, dress:R, opening:R, saturday:R, final_strike:R },
    puppet_construction: { kickoff:R, concepts:R, first_run:R, design_run:R, onsite_run:R, load_in:R, dress:P, opening:P, final_strike:R },
    scenic_builder: { concepts:P, design_run:P, onsite_run:P, load_in:R, final_strike:R },
    qlab_operator: { design_run:P, onsite_run:R, load_in:R, cue_to_cue:R, tech_run:R, dress:R, opening:R, saturday:R, final_strike:R },
    lightboard_operator: { onsite_run:R, load_in:P, cue_to_cue:R, tech_run:R, dress:R, opening:R, saturday:R, final_strike:R },
    photography_marketing: { kickoff:P, concepts:P, first_run:P, design_run:R, onsite_run:R, opening:P, saturday:P, final_strike:P },
    graphic_design: { concepts:D, first_run:D, design_run:D, onsite_run:P },
    house_management: { onsite_run:R, dress:R, opening:R, saturday:R, final_strike:R }
  };

  const LEVEL_RANK = { deadline: 1, preferred: 2, required: 3 };
  const LEVEL_LABEL = { deadline: "Deadline / flexible", preferred: "Preferred", required: "Essential" };
  let currentStep = 1;
  let submissionTimer = null;

  function selectedRoles() {
    return roleInputs.filter(input => input.checked).map(input => input.value);
  }

  function updatePrimaryRole() {
    const chosen = selectedRoles();
    const previous = primaryRole.value;
    primaryRole.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = chosen.length ? "Choose your first preference" : "Select roles above first";
    primaryRole.appendChild(placeholder);

    chosen.forEach(role => {
      const option = document.createElement("option");
      option.value = role;
      option.textContent = ROLE_LABELS[role];
      primaryRole.appendChild(option);
    });

    primaryRole.disabled = chosen.length === 0;
    if (chosen.includes(previous)) primaryRole.value = previous;
  }

  function updateBranches() {
    const branches = new Set(selectedRoles().flatMap(role => BRANCHES[role] || []));
    document.querySelectorAll("[data-branch]").forEach(panel => {
      panel.hidden = !branches.has(panel.dataset.branch);
    });
    document.querySelector("#no-branch-message").hidden = branches.size > 0;
  }

  function getEventLevels() {
    const result = {};
    selectedRoles().forEach(role => {
      const rules = ROLE_EVENT_RULES[role] || {};
      Object.entries(rules).forEach(([eventId, level]) => {
        if (!result[eventId] || LEVEL_RANK[level] > LEVEL_RANK[result[eventId]]) {
          result[eventId] = level;
        }
      });
    });
    return result;
  }

  function renderAvailability() {
    const oldAnswers = {};
    availabilityCalendar.querySelectorAll('input[type="radio"]:checked').forEach(input => {
      oldAnswers[input.name] = input.value;
    });

    const levels = getEventLevels();
    availabilityCalendar.innerHTML = "";

    EVENTS.filter(event => levels[event.id]).forEach(event => {
      const level = levels[event.id];
      const row = document.createElement("div");
      row.className = "calendar-row";
      row.dataset.eventId = event.id;
      row.innerHTML = `
        <div>
          <div class="event-date">${event.date}</div>
          <div class="event-title">${event.title}</div>
        </div>
        <div class="event-level ${level}">${LEVEL_LABEL[level]}</div>
        <div class="availability-options" role="radiogroup" aria-label="Availability for ${event.date}, ${event.title}">
          ${["yes", "maybe", "no"].map(value => `
            <label>
              <input type="radio" name="availability_${event.id}" value="${value}" ${oldAnswers[`availability_${event.id}`] === value ? "checked" : ""}>
              <span>${value[0].toUpperCase() + value.slice(1)}</span>
            </label>
          `).join("")}
        </div>
      `;
      availabilityCalendar.appendChild(row);
    });
  }

  function validateCurrentStep() {
    const step = steps[currentStep - 1];
    let valid = true;

    step.querySelectorAll("input, select, textarea").forEach(field => {
      if (field.offsetParent !== null && !field.checkValidity()) {
        field.classList.add("user-touched");
        valid = false;
      }
    });

    if (currentStep === 2) {
      const hasRole = selectedRoles().length > 0;
      roleError.hidden = hasRole;
      if (!hasRole) valid = false;
    }

    if (currentStep === 4) {
      const visibleEvents = [...availabilityCalendar.querySelectorAll(".calendar-row")];
      const unanswered = visibleEvents.filter(row => !row.querySelector('input[type="radio"]:checked'));
      availabilityError.hidden = unanswered.length === 0;
      if (unanswered.length) {
        valid = false;
        unanswered[0].scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    if (!valid) {
      const firstInvalid = step.querySelector(":invalid");
      if (firstInvalid && firstInvalid.offsetParent !== null) firstInvalid.focus();
    }
    return valid;
  }

  function showStep(number, shouldScroll = true) {
    currentStep = Math.max(1, Math.min(number, steps.length));
    steps.forEach(step => step.classList.toggle("is-active", Number(step.dataset.step) === currentStep));
    const active = steps[currentStep - 1];
    progressBar.style.width = `${(currentStep / steps.length) * 100}%`;
    stepLabel.textContent = `${currentStep} of ${steps.length}`;
    stepName.textContent = active.dataset.stepName;
    if (currentStep === 3) updateBranches();
    if (currentStep === 4) renderAvailability();
    if (currentStep === 5) updateReview();
    if (shouldScroll) {
      document.querySelector(".form-frame").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function getAvailabilityData() {
    const levels = getEventLevels();
    return EVENTS.filter(event => levels[event.id]).map(event => {
      const answer = form.querySelector(`input[name="availability_${event.id}"]:checked`);
      return {
        id: event.id,
        date: event.date,
        event: event.title,
        importance: levels[event.id],
        response: answer ? answer.value : ""
      };
    });
  }

  function value(name) {
    return (form.elements[name]?.value || "").trim();
  }

  function checkedValues(name) {
    return [...form.querySelectorAll(`[name="${name}"]:checked`)].map(input => input.value);
  }

  function buildPayload() {
    const roles = selectedRoles();
    return {
      formVersion: "1.0",
      submittedAtClient: new Date().toISOString(),
      website: value("website"),
      fullName: value("fullName"),
      email: value("email"),
      phone: value("phone"),
      pronouns: value("pronouns"),
      affiliation: value("affiliation"),
      location: value("location"),
      portfolioUrl: value("portfolioUrl"),
      roles,
      roleLabels: roles.map(role => ROLE_LABELS[role]),
      primaryRole: value("primaryRole"),
      primaryRoleLabel: ROLE_LABELS[value("primaryRole")] || "",
      otherRole: value("otherRole"),
      experience: {
        leadershipExperience: value("leadershipExperience"),
        collaborationApproach: value("collaborationApproach"),
        weeklyCommitment: value("weeklyCommitment"),
        designExperience: value("designExperience"),
        designTools: value("designTools"),
        designPortfolioUrl: value("designPortfolioUrl"),
        siteSpecificExperience: value("siteSpecificExperience"),
        practiceExperience: value("practiceExperience"),
        consentApproach: value("consentApproach"),
        fabricationSkills: value("fabricationSkills"),
        buildAvailability: value("buildAvailability"),
        operatorExperience: value("operatorExperience"),
        qlabExperience: value("qlabExperience"),
        consoleExperience: value("consoleExperience"),
        communicationsExperience: value("communicationsExperience"),
        communicationsTools: value("communicationsTools"),
        audienceExperience: value("audienceExperience"),
        additionalExperience: value("additionalExperience")
      },
      availability: getAvailabilityData(),
      generalAvailability: checkedValues("generalAvailability"),
      conflicts: value("conflicts"),
      whyInterested: value("whyInterested"),
      referralSource: value("referralSource"),
      accessNeeds: value("accessNeeds"),
      consent: form.querySelector('[name="consent"]')?.checked === true
    };
  }

  function escapeHtml(text) {
    return String(text || "").replace(/[&<>'"]/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[char]);
  }

  function updateReview() {
    const data = buildPayload();
    const availabilitySummary = data.availability.map(item => `${item.date}: ${item.response || "not answered"}`).join("; ");
    reviewCard.innerHTML = `
      <h3>Review</h3>
      <dl class="review-grid">
        <dt>Name</dt><dd>${escapeHtml(data.fullName)}</dd>
        <dt>Email</dt><dd>${escapeHtml(data.email)}</dd>
        <dt>Roles</dt><dd>${escapeHtml(data.roleLabels.join(", "))}</dd>
        <dt>First choice</dt><dd>${escapeHtml(data.primaryRoleLabel)}</dd>
        <dt>Availability</dt><dd>${escapeHtml(availabilitySummary)}</dd>
      </dl>
    `;
  }

  function submitToGoogleSheet(payload) {
    const config = window.SHADOWS_FORM_CONFIG || {};
    const endpoint = String(config.googleAppsScriptUrl || "").trim();

    if (!endpoint || endpoint.includes("PASTE_YOUR")) {
      throw new Error("This form has not been connected to Google Sheets yet. Add the Apps Script /exec URL in config.js.");
    }

    document.querySelector("#payload-field").value = JSON.stringify(payload);
    form.action = endpoint;
    form.method = "POST";
    form.target = "submission-target";

    let keyInput = form.querySelector('input[name="formKey"]');
    if (!keyInput) {
      keyInput = document.createElement("input");
      keyInput.type = "hidden";
      keyInput.name = "formKey";
      form.appendChild(keyInput);
    }
    keyInput.value = config.formKey || "";

    HTMLFormElement.prototype.submit.call(form);
  }

  function showSuccess() {
    clearTimeout(submissionTimer);
    form.hidden = true;
    progressWrap.hidden = true;
    successPanel.hidden = false;
    submitButton.disabled = false;
    submitButton.textContent = "Send interest form";
    successPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function showSubmitError(message) {
    clearTimeout(submissionTimer);
    submitButton.disabled = false;
    submitButton.textContent = "Send interest form";
    submitError.textContent = message || "The form could not be submitted. Please try again.";
    submitError.hidden = false;
  }

  roleInputs.forEach(input => input.addEventListener("change", () => {
    roleError.hidden = true;
    updatePrimaryRole();
    updateBranches();
  }));

  form.addEventListener("click", event => {
    const next = event.target.closest("[data-next]");
    const back = event.target.closest("[data-back]");
    if (next && validateCurrentStep()) showStep(currentStep + 1);
    if (back) showStep(currentStep - 1);
  });

  form.addEventListener("input", event => {
    event.target.classList.remove("user-touched");
    submitError.hidden = true;
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!validateCurrentStep()) return;

    const payload = buildPayload();
    submitError.hidden = true;
    submitButton.disabled = true;
    submitButton.textContent = "Sending…";

    try {
      submitToGoogleSheet(payload);
      submissionTimer = window.setTimeout(() => {
        showSubmitError("The request was sent, but confirmation took too long. Check the Google Sheet before resubmitting.");
      }, 15000);
    } catch (error) {
      showSubmitError(error.message);
    }
  });

  window.addEventListener("message", event => {
    const data = event.data || {};
    if (data.source !== "shadows-interest-form") return;
    if (data.type === "success") showSuccess();
    if (data.type === "error") showSubmitError(data.message);
  });

  submitAnother.addEventListener("click", () => {
    form.reset();
    form.hidden = false;
    progressWrap.hidden = false;
    successPanel.hidden = true;
    availabilityCalendar.innerHTML = "";
    updatePrimaryRole();
    updateBranches();
    showStep(1);
  });

  updatePrimaryRole();
  updateBranches();
  showStep(1, false);
})();

// The follow-up schedule. Edit the wording and timing here — this is the part
// the church will want to tweak. {name} and {church} are filled in automatically.
//
// daysAfter: how many days after the FIRST visit this message goes out.
//   0  = same evening as their first visit
//   3  = mid-week nudge
//   7  = invite back for the next service
//
// Keep first messages short and warm. For WhatsApp Business, your very first
// template to a new contact must be pre-approved by Meta — paste these in when
// you register your templates.

export const followUpPlan = [
  {
    step: 'day0',
    daysAfter: 0,
    body:
      'Hi {name}, this is {church}. It was so good to have you with us today! ' +
      'We would love to see you again. If you have any questions or a prayer ' +
      'request, just reply to this message. God bless you. 🙏',
  },
  {
    step: 'day3',
    daysAfter: 3,
    body:
      'Hi {name}, {church} here again. We have been thinking about you this week! ' +
      'Is there anything we can pray with you about? You are always welcome here.',
  },
  {
    step: 'day7',
    daysAfter: 7,
    body:
      'Hi {name}, we would love to welcome you back to {church} this weekend. ' +
      'Service details and directions are on our page. Hope to see you there! ' +
      'Reply STOP if you would prefer not to receive these messages.',
  },
];

export function renderBody(template, person, church) {
  const firstName = (person.name || 'friend').trim().split(/\s+/)[0];
  return template
    .replaceAll('{name}', firstName)
    .replaceAll('{church}', church);
}

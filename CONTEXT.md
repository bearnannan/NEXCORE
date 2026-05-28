# Context Glossary

## Mission Control

Mission Control is the operational dashboard for monitoring station state and incident flow.

## Station

A Station is the primary map entity monitored in Mission Control.

## Incident

An Incident is an operational work item tied to a Station. It represents an infrastructure issue reported via webhook or created by an Operations Operator, capturing details about the reporter, raw payload, and LINE Flex Push notification delivery logs.

## Operations Operator

An Operations Operator is the primary Mission Control user who monitors Stations, filters Incidents, inspects operational details, and updates Incident status.

## LINE Flex Message

A LINE Flex Message is a structured push notification with rich layout capabilities sent automatically to the operations LINE group. It utilizes the retro-neon palette to visually encode incident status, severity, and key action links like telephony quick-dial.

## Email Fallback Notification

An Email Fallback Notification is a responsive HTML-formatted alert dispatched via Microsoft 365 SMTP to dopa-only-tm@forth.co.th in the event of a LINE API delivery failure, quota exhaustion, or operational timeout.

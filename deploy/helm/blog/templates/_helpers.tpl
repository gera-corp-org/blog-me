{{/*
Chart name.
*/}}
{{- define "blog.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Full resource name. By default — the release name, so `helm install blog ...`
produces the same names kustomize did (blog, blog-config, ...).
*/}}
{{- define "blog.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Release.Name .Values.nameOverride }}
{{- $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Secret name: existing (existingSecret) or created by the chart.
*/}}
{{- define "blog.secretName" -}}
{{- .Values.secrets.existingSecret | default (printf "%s-secrets" (include "blog.fullname" .)) }}
{{- end }}

{{/*
Chart name with version.
*/}}
{{- define "blog.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "blog.labels" -}}
helm.sh/chart: {{ include "blog.chart" . }}
{{ include "blog.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "blog.selectorLabels" -}}
app.kubernetes.io/name: {{ include "blog.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

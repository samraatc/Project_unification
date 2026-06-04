{{- define "unified-accounting.name" -}}{{ .Chart.Name }}{{- end -}}

{{- define "unified-accounting.fullname" -}}
{{- if .Values.fullnameOverride -}}{{ .Values.fullnameOverride }}{{- else -}}{{ .Release.Name }}-{{ include "unified-accounting.name" . }}{{- end -}}
{{- end -}}

{{- define "unified-accounting.labels" -}}
app.kubernetes.io/name: {{ include "unified-accounting.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{- define "unified-accounting.selectorLabels" -}}
app.kubernetes.io/name: {{ include "unified-accounting.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

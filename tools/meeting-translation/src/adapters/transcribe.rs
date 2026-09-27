use async_trait::async_trait;
use aws_sdk_transcribestreaming::primitives::Blob;
use aws_sdk_transcribestreaming::types::{
    AudioEvent, AudioStream, LanguageCode, MediaEncoding, TranscriptResultStream,
};
use tokio::sync::mpsc;
use tokio_stream::StreamExt;
use tokio_stream::wrappers::UnboundedReceiverStream;

use crate::protocol::Language;
use crate::recognizer::{RecognitionEvent, RecognitionSession, SpeechRecognizer};

const SAMPLE_RATE_HZ: i32 = 16_000;

fn language_code(language: Language) -> LanguageCode {
    match language {
        Language::Japanese => LanguageCode::JaJp,
        Language::English => LanguageCode::EnUs,
    }
}

pub struct TranscribeRecognizer {
    client: aws_sdk_transcribestreaming::Client,
}

impl TranscribeRecognizer {
    pub fn new(client: aws_sdk_transcribestreaming::Client) -> Self {
        Self { client }
    }
}

struct TranscribeSession {
    audio_tx: mpsc::UnboundedSender<Vec<u8>>,
}

impl RecognitionSession for TranscribeSession {
    fn write(&self, chunk: Vec<u8>) {
        // SILENT: A closed audio channel means the recognition session has already stopped.
        let _ = self.audio_tx.send(chunk);
    }

    fn stop(self: Box<Self>) {
        // Dropping audio_tx closes the audio stream and ends the Transcribe session.
    }
}

#[async_trait]
impl SpeechRecognizer for TranscribeRecognizer {
    async fn start(
        &self,
        language: Language,
        events: mpsc::UnboundedSender<RecognitionEvent>,
    ) -> Result<Box<dyn RecognitionSession>, ()> {
        let (audio_tx, audio_rx) = mpsc::unbounded_channel::<Vec<u8>>();
        let audio_stream = UnboundedReceiverStream::new(audio_rx).map(|chunk| {
            Ok(AudioStream::AudioEvent(
                AudioEvent::builder().audio_chunk(Blob::new(chunk)).build(),
            ))
        });

        let output = self
            .client
            .start_stream_transcription()
            .language_code(language_code(language))
            .media_sample_rate_hertz(SAMPLE_RATE_HZ)
            .media_encoding(MediaEncoding::Pcm)
            .audio_stream(audio_stream.into())
            .send()
            .await
            .map_err(|_| ())?;

        let mut transcript_stream = output.transcript_result_stream;
        tokio::spawn(async move {
            loop {
                match transcript_stream.recv().await {
                    Ok(Some(TranscriptResultStream::TranscriptEvent(transcript_event))) => {
                        let Some(transcript) = transcript_event.transcript else {
                            continue;
                        };
                        for result in transcript.results.unwrap_or_default() {
                            let Some(alternatives) = result.alternatives else {
                                continue;
                            };
                            let Some(first) = alternatives.first() else {
                                continue;
                            };
                            let Some(text) = first.transcript.clone() else {
                                continue;
                            };
                            let event = if result.is_partial {
                                RecognitionEvent::Partial(text)
                            } else {
                                RecognitionEvent::Final(text)
                            };
                            if events.send(event).is_err() {
                                return;
                            }
                        }
                    }
                    Ok(Some(_)) => {}
                    Ok(None) => return,
                    Err(_) => {
                        // SILENT: No receiver remains to observe the terminal stream error.
                        let _ = events.send(RecognitionEvent::Error);
                        return;
                    }
                }
            }
        });

        Ok(Box::new(TranscribeSession { audio_tx }))
    }
}
